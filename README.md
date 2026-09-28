# Privoraa AI

Privoraa AI is an educational image studio frontend. This MVP includes the responsive product shell, image prompt workspace, history and account screens, and a founder-area prototype. Image generation, authentication, policy classification, persistence, and server-enforced permissions are not connected yet.

## Development

```sh
npm install
npm run dev
```

## Checks

```sh
npm run lint
npm run build
```

## Routes

- `/` — Home
- `/generate` — Prompt workspace and image preview
- `/history` — Generation history placeholder
- `/login` and `/register` — Authentication UI preview
- `/profile` — Current demo session and logout
- `/access-denied` — Friendly authorization feedback
- `/founder` — Founder dashboard
- `/founder/approvals` — Restricted-prompt review preview
- `/founder/users` — User and permission controls preview
- `/founder/activity` — Sample founder activity log
- `/founder/settings` — Categories, limits, and generation switch preview

## Authentication boundary

The app defaults to an injectable `demoAuthAdapter`. Login and registration create volatile in-memory UI sessions; the founder preview button creates a clearly labeled founder demo session without a password. No session or credentials survive refresh, and no credential is sent to a server. `AuthProvider` accepts a replacement adapter for future backend integration.

Route guards only control frontend navigation. Roles, permission states, approvals, and founder actions must be independently authenticated and authorized by the backend before any protected data or operation is exposed.

## Integration boundaries

The Generate action does not send or store prompts, classify them, or create images. Policy and generation service adapters currently report unavailable. The intended flow is normal prompt → classification → generation; restricted prompt → classification → founder approval/rejection; prohibited prompt → blocked. Founder approval must never bypass provider safeguards, platform policy, or applicable law. Classification, approval decisions, user permissions, limits, and logs must be enforced and persisted server-side.

Founder queue records and user accounts are sample data held in memory for interface review only. They reset on refresh and do not represent real accounts or requests. No API keys or secret credentials belong in frontend code.
