# Module Marketing Email — BD Report

Module d'emailing sortant multi-utilisateurs (façon Lemlist / Outreach / Humanlinker) :
campagnes & séquences multi-emails, messagerie unifiée (inbox + threads), analytics
(ouvertures / clics / réponses), et connexion des boîtes **Gmail** et **Outlook** en OAuth2.

> Le CRM existant (BD Report) est une SPA front-end sans serveur. Ce module nécessite un
> backend (secrets OAuth, stockage/refresh des jetons, envoi via Gmail API / Microsoft Graph,
> endpoints de tracking, détection de réponses). Il est donc livré comme **sous-projet autonome**
> qui s'intègre au CRM via une API REST.

## Architecture

```
email-marketing/
├── db/
│   └── schema.sql            # schéma PostgreSQL (contrat de données)
├── backend/                  # API Node.js / Express + workers
│   ├── src/
│   │   ├── index.js          # point d'entrée API (web)
│   │   ├── config/env.js     # configuration (.env)
│   │   ├── db/               # pool pg + migrate
│   │   ├── lib/              # crypto (AES-256-GCM), tracking (pixel/clics), ai (générateur), http
│   │   ├── middleware/       # auth (HMAC identité CRM), erreurs
│   │   ├── providers/        # gmail.js, outlook.js, index.js (interface unifiée)
│   │   ├── modules/          # accounts, contacts, campaigns, sending, messaging, tracking, analytics, ai
│   │   └── workers/          # sequenceWorker (cron envois), inboxSync (poll + détection réponses)
│   └── package.json
└── frontend/                 # React (Vite) — pages + composants intégrables au CRM
    └── src/
        ├── api/client.js     # client REST
        ├── pages/            # Campaigns, Messaging, Analytics, Settings
        └── components/       # EmailEditor, ContactSelector, CampaignBuilder, Inbox
```

### Choix techniques
- **Backend** : Node ≥ 20, Express, `pg` (PostgreSQL natif, requêtes SQL explicites — pas d'ORM lourd).
- **OAuth2** : `googleapis` (Gmail) ; Microsoft Graph via `fetch` natif. Jetons **chiffrés au repos** (AES-256-GCM),
  **refresh automatique** transparent à chaque appel provider.
- **Envoi** : via la boîte de l'utilisateur (Gmail API `messages.send`, Graph `sendMail`). Rate limiting par
  `daily_limit` de campagne + fenêtre d'envoi (`send_window`).
- **Tracking** : pixel 1×1 (`/t/o/:id.gif`) pour les ouvertures, redirecteur (`/t/c/:id`) pour les clics ;
  le HTML est instrumenté à l'envoi.
- **Séquences** : `workers/sequenceWorker.js` (cron) traite les étapes dues en respectant délais + fenêtre + quota.
- **Réponses** : `workers/inboxSync.js` (polling) synchronise l'inbox, rattache les messages aux contacts,
  émet l'événement `reply` et **stoppe la séquence** si `stop_on_reply`.
- **IA** : `lib/ai.js` pluggable — utilise l'API Claude si `ANTHROPIC_API_KEY` est défini, sinon un générateur
  local de repli (templates). Interface : `generateEmail({ goal, tone, contact, language, context })`.

## API REST (contrat)

Toutes les routes `/api/*` exigent un en-tête `Authorization: Bearer <token>` où `<token>` est l'identité
de l'utilisateur CRM signée HMAC-SHA256 avec `APP_SHARED_SECRET` (voir `middleware/auth.js`,
helper `signIdentity`). Les routes `/t/*` (tracking) sont publiques.

| Domaine     | Routes |
|-------------|--------|
| Boîtes      | `GET /api/accounts/providers` · `GET /api/accounts` · `GET /api/accounts/oauth/:provider/start` · `GET /api/accounts/oauth/:provider/callback` · `DELETE /api/accounts/:id` |
| Contacts    | `GET/POST /api/contacts` · `POST /api/contacts/import` · `PATCH/DELETE /api/contacts/:id` |
| Listes      | `GET /api/contacts/lists/all` · `POST /api/contacts/lists` · `POST /api/contacts/lists/:id/contacts` · `DELETE /api/contacts/lists/:id` |
| Campagnes   | `GET/POST /api/campaigns` · `GET/PATCH/DELETE /api/campaigns/:id` · `PUT /api/campaigns/:id/sequences` · `GET/POST /api/campaigns/:id/contacts` · `POST /api/campaigns/:id/test` |
| Messagerie  | `GET /api/messaging/threads` · `GET /api/messaging/threads/:threadId` · `POST /api/messaging/threads/:threadId/reply` |
| Analytics   | `GET /api/analytics/summary` · `GET /api/analytics/timeseries` · `GET /api/analytics/by-campaign` |
| IA          | `POST /api/ai/generate` |
| Tracking    | `GET /t/o/:trackingId.gif` · `GET /t/c/:trackingId?u=<url>` |

Réponses : `{ ok: true, data }` ou `{ ok: false, error }`.

## Installation

### 1. Base de données
```bash
createdb bdreport_email
psql "$DATABASE_URL" -f db/schema.sql      # ou : cd backend && npm run migrate
```

### 2. Backend
```bash
cd backend
cp .env.example .env        # renseigner DATABASE_URL, TOKEN_ENCRYPTION_KEY, OAuth, etc.
openssl rand -hex 32        # → coller dans TOKEN_ENCRYPTION_KEY
npm install
npm start                   # API sur http://localhost:4000
npm run worker              # (autre terminal) séquences + synchro inbox
```

#### Configurer OAuth
- **Gmail** : Google Cloud Console → API Gmail activée → identifiants OAuth « Application Web » →
  URI de redirection = `GOOGLE_REDIRECT_URI`. Renseigner `GOOGLE_CLIENT_ID/SECRET`.
- **Outlook** : Azure AD → App registration → Redirect URI = `MS_REDIRECT_URI` →
  permissions Microsoft Graph `Mail.Send`, `Mail.Read`, `offline_access`. Renseigner `MS_CLIENT_ID/SECRET`.

### 3. Frontend
```bash
cd frontend
cp .env.example .env        # VITE_EMAIL_API_URL=http://localhost:4000
npm install
npm run dev                 # http://localhost:5173
```

## Intégration au CRM existant
- **Composants** : les pages (`Campaigns`, `Messaging`, `Analytics`, `Settings`) et composants
  (`EmailEditor`, `ContactSelector`, `CampaignBuilder`, `Inbox`) sont du React standard et peuvent être
  copiés dans `src/pages` du CRM (remplacer `styles.css` par les classes Tailwind maison si souhaité).
- **Authentification** : exposer côté CRM une petite fonction qui génère le token signé
  (`signIdentity({ crmUserId, email, name })` avec le secret partagé) puis `setAuthToken(token)` côté client.
- **Sécurité** : jetons OAuth chiffrés (AES-256-GCM) ; ne jamais committer le `.env` ; `APP_SHARED_SECRET`
  et clés OAuth restent côté serveur.

## Schéma de données (résumé)
`users` · `email_accounts` (tokens chiffrés) · `contacts` · `lists` + `list_contacts` · `campaigns` ·
`sequences` (étapes) · `campaign_contacts` (enrôlement + état) · `emails_sent` (+ `tracking_id`) ·
`events` (sent/open/click/reply/bounce/unsubscribe) · `messages` (inbox/threads) · `attachments`.
Détail complet dans `db/schema.sql`.
