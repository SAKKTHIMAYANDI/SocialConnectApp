# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import ValidationError


class SocialProfile(models.Model):
    _name        = 'social.profile'
    _description = 'Social Media Profile Link'
    _rec_name    = 'platform'
    _order       = 'platform'

    # ── Fields ────────────────────────────────────────────────────────────────
    partner_id = fields.Many2one(
        'res.partner', string='Contact',
        required=True, ondelete='cascade', index=True,
    )
    platform = fields.Selection([
        ('facebook',  'Facebook'),
        ('instagram', 'Instagram'),
        ('whatsapp',  'WhatsApp'),
        ('linkedin',  'LinkedIn'),
    ], string='Platform', required=True)

    found        = fields.Boolean(string='Profile Found', default=False)
    handle       = fields.Char(string='Handle / URL')
    profile_url  = fields.Char(string='Direct Profile URL')
    profile_name = fields.Char(string='Profile Name')
    last_seen    = fields.Datetime(string='Last Seen / Active')
    last_lookup  = fields.Datetime(string='Last Lookup', default=fields.Datetime.now)
    lookup_source = fields.Selection([
        ('phone', 'Phone Number'),
        ('email', 'Email Address'),
        ('both',  'Phone + Email'),
    ], string='Lookup Source', default='both')

    # ── Constraints ───────────────────────────────────────────────────────────
    _sql_constraints = [
        ('unique_partner_platform',
         'UNIQUE(partner_id, platform)',
         'A partner can only have one record per social platform.'),
    ]

    # ── API helper ────────────────────────────────────────────────────────────
    def get_api_dict(self):
        """Serialise for mobile API."""
        self.ensure_one()
        return {
            'platform':     self.platform,
            'found':        self.found,
            'handle':       self.handle or None,
            'url':          self.profile_url or None,
            'profile_name': self.profile_name or None,
            'last_seen':    self.last_seen.isoformat() if self.last_seen else None,
        }

    # ── Business logic: upsert ────────────────────────────────────────────────
    @api.model
    def upsert_for_partner(self, partner_id: int, platform: str, data: dict):
        """Create or update a social profile record for a partner."""
        existing = self.search([
            ('partner_id', '=', partner_id),
            ('platform',   '=', platform),
        ], limit=1)

        vals = {
            'partner_id':   partner_id,
            'platform':     platform,
            'found':        data.get('found', False),
            'handle':       data.get('handle'),
            'profile_url':  data.get('url'),
            'profile_name': data.get('profile_name'),
            'last_seen':    data.get('last_seen'),
            'last_lookup':  fields.Datetime.now(),
            'lookup_source': data.get('lookup_source', 'both'),
        }
        if existing:
            existing.write(vals)
            return existing
        return self.create(vals)
