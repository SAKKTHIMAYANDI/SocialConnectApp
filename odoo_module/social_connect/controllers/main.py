# -*- coding: utf-8 -*-
"""
main.py — REST API endpoints for Social Connect mobile app
────────────────────────────────────────────────────────────
Routes:
  POST /api/social_connect/register  (public)
  GET  /api/social_connect/profile   (Bearer token required)
  POST /api/social_connect/lookup    (Bearer token required)
"""

import json
import logging
import re
from datetime import datetime

from odoo import http, fields
from odoo.http import request, Response
from odoo.exceptions import ValidationError, UserError

_logger = logging.getLogger(__name__)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _cors_headers():
    return {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }


def _success(data, status=200):
    return Response(
        json.dumps({'status': 'success', 'data': data}),
        status=status,
        content_type='application/json',
        headers=_cors_headers(),
    )


def _error(message, code='error', status=400):
    return Response(
        json.dumps({'status': 'error', 'error': message, 'error_code': code}),
        status=status,
        content_type='application/json',
        headers=_cors_headers(),
    )


def _get_bearer_token_data():
    """
    Validate Authorization: Bearer <token> header.
    Returns token payload dict from oauth2 controller's _ACCESS_TOKENS,
    or None if invalid / missing.
    """
    from .oauth2 import _ACCESS_TOKENS
    auth = request.httprequest.headers.get('Authorization', '')
    if not auth.startswith('Bearer '):
        return None
    token = auth[7:]
    stored = _ACCESS_TOKENS.get(token)
    if not stored:
        return None
    if datetime.utcnow() > stored['expiry']:
        _ACCESS_TOKENS.pop(token, None)
        return None
    return stored


def _require_auth():
    """Returns (token_data, None) or (None, error_response)."""
    data = _get_bearer_token_data()
    if not data:
        return None, _error('Authentication required. Provide a valid Bearer token.', 'unauthorized', 401)
    return data, None


# ─── Controller ───────────────────────────────────────────────────────────────

class SocialConnectController(http.Controller):

    # ── OPTIONS preflight ─────────────────────────────────────────────────────
    @http.route([
        '/api/social_connect/register',
        '/api/social_connect/profile',
        '/api/social_connect/lookup',
    ], type='http', auth='none', methods=['OPTIONS'], csrf=False)
    def options(self, **kw):
        return Response(status=204, headers=_cors_headers())

    # ── POST /api/social_connect/register ─────────────────────────────────────
    @http.route('/api/social_connect/register', type='http', auth='none',
                methods=['POST'], csrf=False)
    def register(self, **kw):
        """
        Public endpoint — creates a new Odoo res.users + res.partner.
        Body (JSON):
          first_name, last_name, phone, email (optional), password
        """
        try:
            body = json.loads(request.httprequest.data or '{}')
        except json.JSONDecodeError:
            return _error('Invalid JSON body', 'invalid_request')

        # ── Validate required fields ──────────────────────────────────────────
        first_name = (body.get('first_name') or '').strip()
        last_name  = (body.get('last_name')  or '').strip()
        phone      = (body.get('phone')      or '').strip()
        email      = (body.get('email')      or '').strip()
        password   = body.get('password', '')

        errors = {}
        if not first_name:       errors['first_name'] = 'First name is required.'
        if not last_name:        errors['last_name']  = 'Last name is required.'
        if not phone:            errors['phone']      = 'Mobile number is required.'
        if not password or len(password) < 8:
            errors['password'] = 'Password must be at least 8 characters.'
        if email and not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
            errors['email'] = 'Invalid email address.'

        if errors:
            return Response(
                json.dumps({'status': 'error', 'errors': errors}),
                status=422, content_type='application/json', headers=_cors_headers(),
            )

        # ── Check duplicates ──────────────────────────────────────────────────
        env = request.env(user=1)  # SUPERUSER for registration

        existing_phone = env['res.partner'].search([('mobile', '=', phone)], limit=1)
        if existing_phone:
            return _error('A user with this phone number already exists.', 'duplicate_phone', 409)

        if email:
            existing_email = env['res.users'].search([('login', '=', email)], limit=1)
            if existing_email:
                return _error('A user with this email already exists.', 'duplicate_email', 409)

        # ── Create user ───────────────────────────────────────────────────────
        try:
            full_name = f'{first_name} {last_name}'
            login     = email if email else phone

            user_vals = {
                'name':     full_name,
                'login':    login,
                'password': password,
                'email':    email,
                'groups_id': [(4, env.ref('base.group_portal').id)],
            }
            new_user = env['res.users'].create(user_vals)

            # Update partner with mobile + app flags
            new_user.partner_id.write({
                'mobile':             phone,
                'email':              email,
                'app_user':           True,
                'app_registered_at':  fields.Datetime.now(),
            })

            _logger.info('SocialConnect: New user registered — %s (uid=%d)', full_name, new_user.id)

            return _success(new_user.partner_id.get_api_dict(), status=201)

        except (ValidationError, UserError) as e:
            return _error(str(e), 'validation_error', 422)
        except Exception as e:
            _logger.exception('SocialConnect register error: %s', e)
            return _error('An unexpected error occurred. Please try again.', 'server_error', 500)

    # ── GET /api/social_connect/profile ───────────────────────────────────────
    @http.route('/api/social_connect/profile', type='http', auth='none',
                methods=['GET'], csrf=False)
    def profile(self, **kw):
        """
        Authenticated — returns the current user's profile.
        Requires: Authorization: Bearer <access_token>
        """
        token_data, err = _require_auth()
        if err:
            return err

        env     = request.env(user=1)
        partner = env['res.partner'].browse(token_data['partner_id'])
        if not partner.exists():
            return _error('User profile not found.', 'not_found', 404)

        return _success(partner.get_api_dict())

    # ── POST /api/social_connect/lookup ───────────────────────────────────────
    @http.route('/api/social_connect/lookup', type='http', auth='none',
                methods=['POST'], csrf=False)
    def lookup(self, **kw):
        """
        Authenticated — looks up social profiles for the given phone + email.

        Body (JSON): { "phone": "...", "email": "..." }

        Returns a list of social profile objects for all 4 platforms.
        Results are cached in the social.profile model for the partner.
        """
        token_data, err = _require_auth()
        if err:
            return err

        try:
            body = json.loads(request.httprequest.data or '{}')
        except json.JSONDecodeError:
            return _error('Invalid JSON body', 'invalid_request')

        phone = (body.get('phone') or '').strip()
        email = (body.get('email') or '').strip()

        if not phone and not email:
            return _error('Provide at least a phone number or email address.', 'missing_params')

        env        = request.env(user=1)
        partner_id = token_data['partner_id']

        # ── Run lookup per platform ───────────────────────────────────────────
        results = []
        for platform in ('facebook', 'instagram', 'whatsapp', 'linkedin'):
            profile_data = self._lookup_platform(platform, phone, email, env)
            # Persist / update in DB
            env['social.profile'].upsert_for_partner(partner_id, platform, profile_data)
            results.append(profile_data)

        return _success(results)

    # ── Platform lookup logic ─────────────────────────────────────────────────

    def _lookup_platform(self, platform: str, phone: str, email: str, env) -> dict:
        """
        Real implementation should call external APIs or scraping services.
        Replace each block below with your actual lookup integration.

        Supported integrations:
          - Facebook Graph API  (requires Business Verification)
          - Instagram Basic Display API
          - WhatsApp Business API (phone number lookup)
          - LinkedIn REST API (requires Partner Program)
        """
        # First check if we already have a recent cached result in DB
        existing = env['social.profile'].search([
            ('partner_id.id', '=', env['res.partner'].browse(
                env['res.users'].search([('partner_id', '=',
                    env['res.partner'].search([
                        '|', ('mobile', '=', phone), ('email', '=', email)
                    ], limit=1).id)], limit=1).partner_id.id
            ).id if phone or email else 0),
            ('platform', '=', platform),
        ], limit=1)

        # ── Per-platform lookup ───────────────────────────────────────────────
        if platform == 'facebook':
            return self._lookup_facebook(phone, email)
        elif platform == 'instagram':
            return self._lookup_instagram(phone, email)
        elif platform == 'whatsapp':
            return self._lookup_whatsapp(phone)
        elif platform == 'linkedin':
            return self._lookup_linkedin(email)
        return {'platform': platform, 'found': False}

    def _lookup_facebook(self, phone: str, email: str) -> dict:
        """
        Facebook Graph API lookup.
        Requires: Facebook Business Verification + Advanced Access for
                  `user_mobile_phone` and `email` permissions.
        Docs: https://developers.facebook.com/docs/graph-api/
        """
        # TODO: Implement real Facebook Graph API call
        # import requests
        # resp = requests.get(
        #     'https://graph.facebook.com/v19.0/search',
        #     params={'q': email, 'type': 'user', 'access_token': FB_APP_TOKEN}
        # )
        # if resp.ok and resp.json().get('data'):
        #     user = resp.json()['data'][0]
        #     return {
        #         'platform': 'facebook', 'found': True,
        #         'handle':   f"facebook.com/{user['id']}",
        #         'url':      f"https://facebook.com/{user['id']}",
        #         'profile_name': user.get('name'),
        #         'lookup_source': 'email',
        #     }

        # Placeholder — replace with real API call
        _logger.info('SocialConnect: Facebook lookup for phone=%s email=%s', phone, email)
        return {'platform': 'facebook', 'found': False, 'lookup_source': 'email'}

    def _lookup_instagram(self, phone: str, email: str) -> dict:
        """
        Instagram Basic Display API / Business Discovery API.
        Requires: Instagram Business Account + Graph API access.
        Docs: https://developers.facebook.com/docs/instagram-api/
        """
        # TODO: Implement real Instagram API call
        _logger.info('SocialConnect: Instagram lookup for email=%s', email)
        return {'platform': 'instagram', 'found': False, 'lookup_source': 'email'}

    def _lookup_whatsapp(self, phone: str) -> dict:
        """
        WhatsApp Business API — check if a phone number is registered.
        Requires: WhatsApp Business API access (Meta for Developers).
        Docs: https://developers.facebook.com/docs/whatsapp/
        """
        if not phone:
            return {'platform': 'whatsapp', 'found': False}

        # TODO: Implement real WhatsApp Business API call
        # import requests
        # clean_phone = re.sub(r'[^\d+]', '', phone)
        # resp = requests.post(
        #     f'https://graph.facebook.com/v19.0/{WA_PHONE_NUMBER_ID}/messages',
        #     headers={'Authorization': f'Bearer {WA_ACCESS_TOKEN}'},
        #     json={'messaging_product': 'whatsapp', 'to': clean_phone, 'type': 'template', ...}
        # )

        _logger.info('SocialConnect: WhatsApp lookup for phone=%s', phone)
        return {
            'platform': 'whatsapp',
            'found': bool(phone),
            'handle': f'Active · {phone}' if phone else None,
            'lookup_source': 'phone',
        }

    def _lookup_linkedin(self, email: str) -> dict:
        """
        LinkedIn REST API — profile lookup by email.
        Requires: LinkedIn Partner Program (r_emailaddress scope).
        Docs: https://docs.microsoft.com/en-us/linkedin/
        """
        if not email:
            return {'platform': 'linkedin', 'found': False}

        # TODO: Implement real LinkedIn API call
        # import requests
        # resp = requests.get(
        #     'https://api.linkedin.com/v2/emailAddress',
        #     params={'q': 'members', 'email': email},
        #     headers={'Authorization': f'Bearer {LINKEDIN_ACCESS_TOKEN}'}
        # )

        _logger.info('SocialConnect: LinkedIn lookup for email=%s', email)
        return {'platform': 'linkedin', 'found': False, 'lookup_source': 'email'}
