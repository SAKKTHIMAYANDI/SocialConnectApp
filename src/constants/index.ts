// ─── Colors ──────────────────────────────────────────────────────────────────
export const Colors = {
  bg: '#0a0a0f',
  surface: '#13131a',
  surface2: '#1c1c27',
  accent: '#7c5cfc',
  accentLight: '#9b6eff',
  accent2: '#fc5c7d',
  text: '#f0f0ff',
  textMuted: '#6b6b8a',
  border: 'rgba(255,255,255,0.07)',
  success: '#25D366',
  error: '#fc5c7d',
  white: '#ffffff',
  facebook: '#1877F2',
  instagram: '#E1306C',
  whatsapp: '#25D366',
  linkedin: '#0A66C2',
} as const;

// ─── Odoo 18 + OAuth2 Config ─────────────────────────────────────────────────
export const Config = {
  // ┌─────────────────────────────────────────────────────┐
  // │  Replace these values with your Odoo 18 instance   │
  // └─────────────────────────────────────────────────────┘
  ODOO_BASE_URL: 'https://your-odoo18.yourcompany.com',
  ODOO_DB: 'your_database_name',

  // OAuth2 endpoints (configured in Odoo 18 via Settings > OAuth Providers)
  OAUTH2_AUTHORIZE_URL: 'https://your-odoo18.yourcompany.com/oauth2/authorize',
  OAUTH2_TOKEN_URL: 'https://your-odoo18.yourcompany.com/oauth2/token',
  OAUTH2_USERINFO_URL: 'https://your-odoo18.yourcompany.com/oauth2/userinfo',
  OAUTH2_REVOKE_URL: 'https://your-odoo18.yourcompany.com/oauth2/revoke',

  // OAuth2 client credentials
  // Register your app in Odoo 18: Settings > Technical > OAuth > Providers
  OAUTH2_CLIENT_ID: 'your_mobile_app_client_id',
  OAUTH2_CLIENT_SECRET: 'your_client_secret',        // Only if confidential client
  OAUTH2_REDIRECT_URI: 'socialconnect://oauth2/callback',
  OAUTH2_SCOPES: ['openid', 'profile', 'email', 'social_connect'],

  // Custom module REST endpoints
  REGISTER_URL: '/api/social_connect/register',
  SOCIAL_LOOKUP_URL: '/api/social_connect/lookup',
  USER_PROFILE_URL: '/api/social_connect/profile',

  // Secure storage keys
  KEYS: {
    ACCESS_TOKEN: 'sc_access_token',
    REFRESH_TOKEN: 'sc_refresh_token',
    TOKEN_EXPIRY: 'sc_token_expiry',
    USER: 'sc_user',
    CODE_VERIFIER: 'sc_code_verifier',
  },

  // Token settings
  TOKEN_REFRESH_BUFFER_SECONDS: 60,
} as const;
