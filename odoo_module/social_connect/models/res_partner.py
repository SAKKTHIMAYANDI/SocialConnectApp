# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import ValidationError
import re


class ResPartner(models.Model):
    _inherit = 'res.partner'

    # ── Mobile App Fields ─────────────────────────────────────────────────────
    mobile_verified     = fields.Boolean(string='Mobile Verified', default=False)
    email_verified      = fields.Boolean(string='Email Verified',  default=False)
    app_user            = fields.Boolean(string='Mobile App User',  default=False, index=True)
    app_registered_at   = fields.Datetime(string='App Registration Date', readonly=True)

    # ── Social Profile Links (one2many) ───────────────────────────────────────
    social_profile_ids  = fields.One2many(
        'social.profile', 'partner_id',
        string='Social Profiles',
    )
    social_profiles_count = fields.Integer(
        string='Linked Social Profiles',
        compute='_compute_social_count',
        store=True,
    )

    # ── Computed ──────────────────────────────────────────────────────────────
    @api.depends('social_profile_ids')
    def _compute_social_count(self):
        for rec in self:
            rec.social_profiles_count = len(rec.social_profile_ids.filtered('found'))

    # ── Constraints ───────────────────────────────────────────────────────────
    @api.constrains('mobile')
    def _check_mobile_format(self):
        for rec in self:
            if rec.mobile and not re.match(r'^\+?[\d\s\-()]{7,}$', rec.mobile):
                raise ValidationError(
                    _('Invalid mobile number format: %s') % rec.mobile
                )

    # ── API helper ────────────────────────────────────────────────────────────
    def get_api_dict(self):
        """Return a JSON-safe dict for the mobile API response."""
        self.ensure_one()
        return {
            'id':         self.id,
            'name':       self.name or '',
            'phone':      self.mobile or self.phone or '',
            'email':      self.email or '',
            'avatar_url': f'/web/image/res.partner/{self.id}/image_128'
                          if self.image_128 else None,
        }
