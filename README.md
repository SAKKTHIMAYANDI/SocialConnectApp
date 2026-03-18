# SocialConnect — React Native + Odoo 18 Enterprise

## Project Structure

```
SocialConnectApp/
├── App.tsx                          # Root entry point
├── app.json                         # Expo config
├── package.json
├── tsconfig.json
│
├── src/
│   ├── constants/
│   │   └── index.ts                 # ⚠️  CONFIGURE THIS FIRST
│   │
│   ├── services/
│   │   ├── oauth2Service.ts         # OAuth2 PKCE client (Odoo 18)
│   │   └── apiService.ts            # REST API calls
│   │
│   ├── store/
│   │   └── authStore.ts             # Zustand auth state
│   │
│   ├── navigation/
│   │   └── AppNavigator.tsx         # Stack navigator
│   │
│   ├── screens/
│   │   ├── WelcomeScreen.tsx
│   │   ├── RegisterScreen.tsx
│   │   ├── LoginScreen.tsx
│   │   └── HomeScreen.tsx
│   │
│   └── components/
│       ├── Button.tsx
│       ├── Input.tsx
│       └── SocialCard.tsx
│
└── odoo_module/
    └── social_connect/              # Copy to Odoo addons folder
        ├── __manifest__.py
        ├── models/
        │   ├── res_partner.py       # Extends partner with app fields
        │   └── social_profile.py   # social.profile model
        ├── controllers/
        │   ├── oauth2.py            # OAuth2 endpoints
        │   └── main.py              # REST API endpoints
        ├── security/
        │   ├── ir.model.access.csv
        │   └── security.xml
        ├── views/
        │   ├── social_profile_views.xml
        │   └── res_partner_views.xml
        └── data/
            └── oauth_provider_data.xml
```

---

## Step 1 — Set Up Odoo 18 Enterprise Backend

### 1.1 Install the module
```bash
# Copy module to your Odoo addons directory
cp -r odoo_module/social_connect /path/to/odoo/addons/

# Restart Odoo
sudo systemctl restart odoo

# Install via CLI
odoo -d YOUR_DB --install social_connect
```
Or go to **Apps → Search "Social Connect" → Install**

### 1.2 Configure OAuth2 Provider
1. Go to **Settings → Technical → OAuth → Providers**
2. Open **"Social Connect Mobile App"**
3. Fill in:
   - **Client ID**: generate a unique string (e.g. `sc_mobile_app_2024`)
   - Copy it to `src/constants/index.ts` → `OAUTH2_CLIENT_ID`
4. Set **Redirect URIs**: `socialconnect://oauth2/callback`
5. Enable the provider

### 1.3 Enable OAuth login
Settings → General Settings → Integrations → Enable OAuth Authentication ✓

---

## Step 2 — Configure the React Native App

Edit **`src/constants/index.ts`**:


---

## Step 3 — Run the App

```bash
# update software in ubuntu
sudo apt update

# install nodejs
sudo apt install nodejs npm -y

# Install dependencies
rm -rf node_modules package-lock.json
npm install
npx expo start -c

# Start Expo
npx expo start

# Android
npx expo start --android

# iOS
npx expo start --ios
```

---

## Authentication Flow

```
Mobile App                          Odoo 18
    │                                   │
    │  1. Generate code_verifier         │
    │     + code_challenge (SHA256)      │
    │                                   │
    │  2. Open browser:                  │
    │     GET /oauth2/authorize?         │
    │       code_challenge=...          │
    │       client_id=...               │──────────────────────►│
    │                                   │  Odoo login page shown│
    │                                   │◄──────────────────────│
    │  3. User logs in to Odoo          │
    │                                   │──────────────────────►│
    │  4. Odoo redirects:               │
    │     socialconnect://callback      │
    │       ?code=AUTH_CODE             │◄──────────────────────│
    │                                   │
    │  5. POST /oauth2/token            │
    │     code=AUTH_CODE                │
    │     code_verifier=VERIFIER        │──────────────────────►│
    │                                   │  Verify PKCE          │
    │  6. Receive:                      │◄──────────────────────│
    │     access_token  (1 hour)        │
    │     refresh_token (30 days)       │
    │     → stored in SecureStore       │
    │                                   │
    │  7. GET /api/social_connect/      │
    │     profile                       │
    │     Authorization: Bearer <token>│──────────────────────►│
    │                                   │◄──────────────────────│
    │  8. POST /api/social_connect/     │
    │     lookup                        │──────────────────────►│
```

---

## Social Lookup Integration

The lookup endpoint in `controllers/main.py` has `TODO` blocks for real API integration:

| Platform  | API Required                         | Docs |
|-----------|--------------------------------------|------|
| Facebook  | Facebook Graph API (Business)        | https://developers.facebook.com/docs/graph-api |
| Instagram | Instagram Business Discovery API     | https://developers.facebook.com/docs/instagram-api |
| WhatsApp  | WhatsApp Business API                | https://developers.facebook.com/docs/whatsapp |
| LinkedIn  | LinkedIn REST API (Partner Program)  | https://docs.microsoft.com/en-us/linkedin |

---

## API Reference

### POST `/api/social_connect/register` (Public)
```json
Request:  { "first_name": "John", "last_name": "Doe",
            "phone": "+1 234 567 8900", "email": "john@example.com",
            "password": "SecurePass1" }
Response: { "status": "success", "data": { "id": 42, "name": "John Doe",
            "phone": "+1 234 567 8900", "email": "john@example.com" } }
```

### GET `/api/social_connect/profile` (Bearer token)
```json
Response: { "status": "success", "data": { "id": 42, "name": "...", ... } }
```

### POST `/api/social_connect/lookup` (Bearer token)
```json
Request:  { "phone": "+1 234 567 8900", "email": "john@example.com" }
Response: { "status": "success", "data": [
    { "platform": "facebook",  "found": true,  "handle": "facebook.com/john.doe", "url": "..." },
    { "platform": "instagram", "found": true,  "handle": "@john_doe" },
    { "platform": "whatsapp",  "found": true,  "handle": "Active · +1 234 567 8900" },
    { "platform": "linkedin",  "found": false }
]}
```

---

## Tech Stack

| Layer         | Technology                              |
|---------------|-----------------------------------------|
| Mobile        | React Native + Expo SDK 51              |
| Auth          | OAuth2 Authorization Code + PKCE        |
| Token Storage | expo-secure-store (device secure enclave)|
| State         | Zustand                                 |
| Forms         | React Hook Form + Zod                   |
| Backend       | Odoo 18 Enterprise                      |
| API           | Custom REST controllers (Python)        |
| DB            | PostgreSQL (via Odoo ORM)               |
