# -*- coding: utf-8 -*-
{
    'name': 'Social Connect Mobile API',
    'version': '18.0.1.0.0',
    'category': 'Extra Tools',
    'summary': 'OAuth2 + REST API backend for Social Connect mobile app',
    'description': """
Social Connect — Odoo 18 Enterprise Backend Module
====================================================

Provides:
  • Custom OAuth2 provider endpoints (authorize / token / userinfo / revoke)
  • Public REST: POST /api/social_connect/register
  • Authenticated REST: GET  /api/social_connect/profile
  • Authenticated REST: POST /api/social_connect/lookup
  • res.partner extension for mobile / social profile fields
  • social.profile model to store found platform links
  • Full CORS support for Expo mobile client

OAuth2 Setup (after install):
  Settings → Technical → OAuth → Providers → Create
    - Name: SocialConnect Mobile App
    - Client ID: (copy to app constants)
    - Client Secret: (copy to app constants)
    - Redirect URIs: socialconnect://oauth2/callback
    - Scopes: openid profile email social_connect
    - Flow: Authorization Code + PKCE
    """,
    'author': 'Your Company',
    'website': 'https://yourcompany.com',
    'license': 'OEL-1',
    'depends': [
        'base',
        'web',
        'contacts',
        'auth_oauth',
        'auth_signup',
        'mail',
    ],
    'data': [
        'security/ir.model.access.csv',
        'security/security.xml',
        'views/social_profile_views.xml',
        'views/res_partner_views.xml',
        'data/oauth_provider_data.xml',
    ],
    'installable': True,
    'auto_install': False,
    'application': False,
    'external_dependencies': {'python': []},
}
