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
- `/founder` — Founder dashboard
- `/founder/approvals` — Restricted-prompt review preview
- `/founder/users` — User and permission controls preview
- `/founder/settings` — Categories, limits, and generation switch preview

## Integration boundaries

The Generate action does not send or store prompts and does not create images. Connect a backend generation service before enabling it. Authentication, policy classification, approval decisions, user permissions, limits, and logs must also be enforced and persisted server-side. Founder approval must never bypass provider safeguards, platform policy, or applicable law; prohibited requests must remain blocked.

Founder queue records and user accounts are sample data held in memory for interface review only. They reset on refresh and do not represent real accounts or requests. No API keys or secret credentials belong in frontend code.
