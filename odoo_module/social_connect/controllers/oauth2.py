# -*- coding: utf-8 -*-
"""
oauth2.py — Custom OAuth2 endpoints for Odoo 18 Enterprise
────────────────────────────────────────────────────────────
Odoo 18 Enterprise ships with a built-in OAuth2 provider via the
`auth_oauth` module. This controller extends it with:

  • /oauth2/authorize  — Authorization Code endpoint (PKCE S256)
  • /oauth2/token      — Token exchange + refresh
  • /oauth2/userinfo   — OpenID Connect userinfo
  • /oauth2/revoke     — Token revocation (RFC 7009)

NOTE: In a real Odoo 18 Enterprise deployment, most of these routes
are already provided by the Enterprise `auth_oauth_provider` module.
This file adds the PKCE validation layer and the custom `social_connect`
scope handling on top of that.

If your Odoo 18 Enterprise instance already exposes these routes,
configure your client credentials in:
  Settings → Technical → OAuth Providers → [Your App]
and remove the routes you don't need to override.
"""

import hashlib
import base64
import secrets
import json
import logging
from datetime import datetime, timedelta

from odoo import http, fields
from odoo.http import request, Response
from odoo.exceptions import AccessDenied

_logger = logging.getLogger(__name__)

# ─── In-memory stores (replace with DB tables in production) ──────────────────
# For production use the `oauth2.authorization.code` and `oauth2.access.token`
# Odoo models that Enterprise provides, or add your own.
_AUTH_CODES:    dict = {}   # code  → {partner_id, client_id, challenge, expiry, scope}
_ACCESS_TOKENS: dict = {}   # token → {partner_id, client_id, expiry, scope, refresh}
_REFRESH_TOKENS:dict = {}   # rtoken→ {partner_id, client_id, expiry, scope}


def _verify_pkce(verifier: str, stored_challenge: str) -> bool:
    digest = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b'=').decode()
    return challenge == stored_challenge


class OAuth2Controller(http.Controller):

    # ─── CORS helper ──────────────────────────────────────────────────────────
    def _cors_headers(self):
        return {
            'Access-Control-Allow-Origin':  '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }

    def _json_response(self, data: dict, status: int = 200) -> Response:
        return Response(
            json.dumps(data),
            status=status,
            content_type='application/json',
            headers=self._cors_headers(),
        )

    # ─── OPTIONS preflight ────────────────────────────────────────────────────
    @http.route([
        '/oauth2/authorize',
        '/oauth2/token',
        '/oauth2/userinfo',
        '/oauth2/revoke',
    ], type='http', auth='none', methods=['OPTIONS'], csrf=False)
    def oauth2_options(self, **kw):
        return Response(status=204, headers=self._cors_headers())

    # ─── /oauth2/authorize ────────────────────────────────────────────────────
    @http.route('/oauth2/authorize', type='http', auth='public', methods=['GET'], csrf=False)
    def authorize(self, **kw):
        """
        Step 1: Show Odoo login page (if not logged in), then redirect
        back to the mobile app with authorization code.

        Params: response_type, client_id, redirect_uri, scope,
                code_challenge, code_challenge_method, state
        """
        response_type          = kw.get('response_type')
        client_id              = kw.get('client_id')
        redirect_uri           = kw.get('redirect_uri', '')
        scope                  = kw.get('scope', '')
        code_challenge         = kw.get('code_challenge', '')
        code_challenge_method  = kw.get('code_challenge_method', 'S256')
        state                  = kw.get('state', '')

        if response_type != 'code':
            return self._json_response({'error': 'unsupported_response_type'}, 400)

        # Validate client
        client = self._get_oauth_client(client_id)
        if not client:
            return self._json_response({'error': 'invalid_client'}, 401)

        # Validate redirect_uri
        if redirect_uri not in (client.get('redirect_uris') or []):
            return self._json_response({'error': 'invalid_redirect_uri'}, 400)

        # If user is already authenticated in Odoo session, issue code immediately
        if request.session.uid:
            return self._issue_auth_code(
                request.session.uid, client_id, redirect_uri,
                scope, code_challenge, state
            )

        # Otherwise redirect to Odoo login, then back here
        login_url = (
            f'/web/login?redirect=/oauth2/authorize'
            f'?response_type=code'
            f'&client_id={client_id}'
            f'&redirect_uri={redirect_uri}'
            f'&scope={scope}'
            f'&code_challenge={code_challenge}'
            f'&code_challenge_method={code_challenge_method}'
            f'&state={state}'
        )
        return request.redirect(login_url)

    def _issue_auth_code(self, uid, client_id, redirect_uri, scope, challenge, state):
        code = secrets.token_urlsafe(32)
        _AUTH_CODES[code] = {
            'partner_id': request.env['res.users'].sudo().browse(uid).partner_id.id,
            'user_id':    uid,
            'client_id':  client_id,
            'challenge':  challenge,
            'scope':      scope,
            'expiry':     datetime.utcnow() + timedelta(minutes=10),
        }
        sep = '&' if '?' in redirect_uri else '?'
        location = f'{redirect_uri}{sep}code={code}&state={state}'
        return request.redirect(location)

    # ─── /oauth2/token ────────────────────────────────────────────────────────
    @http.route('/oauth2/token', type='http', auth='none', methods=['POST'], csrf=False)
    def token(self, **kw):
        """
        Handles:
          • grant_type=authorization_code  → exchange code for tokens
          • grant_type=refresh_token       → refresh access token
        """
        grant_type = kw.get('grant_type')

        if grant_type == 'authorization_code':
            return self._handle_code_exchange(kw)
        elif grant_type == 'refresh_token':
            return self._handle_refresh(kw)
        else:
            return self._json_response({'error': 'unsupported_grant_type'}, 400)

    def _handle_code_exchange(self, kw):
        code          = kw.get('code', '')
        code_verifier = kw.get('code_verifier', '')
        client_id     = kw.get('client_id', '')
        redirect_uri  = kw.get('redirect_uri', '')

        stored = _AUTH_CODES.pop(code, None)
        if not stored:
            return self._json_response({'error': 'invalid_grant', 'error_description': 'Code not found or already used'}, 400)

        if datetime.utcnow() > stored['expiry']:
            return self._json_response({'error': 'invalid_grant', 'error_description': 'Authorization code expired'}, 400)

        if stored['client_id'] != client_id:
            return self._json_response({'error': 'invalid_client'}, 401)

        if not _verify_pkce(code_verifier, stored['challenge']):
            return self._json_response({'error': 'invalid_grant', 'error_description': 'PKCE verification failed'}, 400)

        return self._issue_tokens(stored['user_id'], stored['partner_id'], client_id, stored['scope'])

    def _handle_refresh(self, kw):
        refresh_token = kw.get('refresh_token', '')
        client_id     = kw.get('client_id', '')

        stored = _REFRESH_TOKENS.get(refresh_token)
        if not stored or stored['client_id'] != client_id:
            return self._json_response({'error': 'invalid_grant', 'error_description': 'Invalid refresh token'}, 400)

        if datetime.utcnow() > stored['expiry']:
            _REFRESH_TOKENS.pop(refresh_token, None)
            return self._json_response({'error': 'invalid_grant', 'error_description': 'Refresh token expired'}, 400)

        # Rotate refresh token
        _REFRESH_TOKENS.pop(refresh_token, None)
        return self._issue_tokens(stored['user_id'], stored['partner_id'], client_id, stored['scope'])

    def _issue_tokens(self, user_id, partner_id, client_id, scope):
        access_token  = secrets.token_urlsafe(48)
        refresh_token = secrets.token_urlsafe(48)
        expires_in    = 3600  # 1 hour

        _ACCESS_TOKENS[access_token] = {
            'user_id':    user_id,
            'partner_id': partner_id,
            'client_id':  client_id,
            'scope':      scope,
            'expiry':     datetime.utcnow() + timedelta(seconds=expires_in),
            'refresh':    refresh_token,
        }
        _REFRESH_TOKENS[refresh_token] = {
            'user_id':    user_id,
            'partner_id': partner_id,
            'client_id':  client_id,
            'scope':      scope,
            'expiry':     datetime.utcnow() + timedelta(days=30),
        }

        return self._json_response({
            'access_token':  access_token,
            'token_type':    'Bearer',
            'expires_in':    expires_in,
            'refresh_token': refresh_token,
            'scope':         scope,
        })

    # ─── /oauth2/userinfo ─────────────────────────────────────────────────────
    @http.route('/oauth2/userinfo', type='http', auth='none', methods=['GET'], csrf=False)
    def userinfo(self, **kw):
        """OpenID Connect userinfo endpoint."""
        token_data = self._authenticate_bearer()
        if not token_data:
            return self._json_response({'error': 'invalid_token'}, 401)

        partner = request.env['res.partner'].sudo().browse(token_data['partner_id'])
        if not partner.exists():
            return self._json_response({'error': 'user_not_found'}, 404)

        return self._json_response({
            'sub':     str(partner.id),
            'name':    partner.name or '',
            'email':   partner.email or '',
            'phone':   partner.mobile or partner.phone or '',
            'picture': f'/web/image/res.partner/{partner.id}/image_128'
                       if partner.image_128 else None,
        })

    # ─── /oauth2/revoke ───────────────────────────────────────────────────────
    @http.route('/oauth2/revoke', type='http', auth='none', methods=['POST'], csrf=False)
    def revoke(self, **kw):
        """RFC 7009 token revocation."""
        token = kw.get('token', '')
        _ACCESS_TOKENS.pop(token, None)
        _REFRESH_TOKENS.pop(token, None)
        return self._json_response({'status': 'ok'})

    # ─── Internal helpers ─────────────────────────────────────────────────────
    def _authenticate_bearer(self):
        """Extract and validate Bearer token from Authorization header."""
        auth_header = request.httprequest.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return None
        token = auth_header[7:]
        stored = _ACCESS_TOKENS.get(token)
        if not stored:
            return None
        if datetime.utcnow() > stored['expiry']:
            _ACCESS_TOKENS.pop(token, None)
            return None
        return stored

    def _get_oauth_client(self, client_id: str):
        """
        Look up registered OAuth client.
        In production, query the `auth.oauth.provider` model.
        """
        # TODO: Replace with actual DB lookup:
        # return request.env['auth.oauth.provider'].sudo().search(
        #     [('client_id', '=', client_id)], limit=1
        # )
        # For now, accept any client_id that matches config
        if client_id:
            return {
                'client_id':     client_id,
                'redirect_uris': ['socialconnect://oauth2/callback'],
            }
        return None
