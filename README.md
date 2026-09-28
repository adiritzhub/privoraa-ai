# Privoraa AI

Privoraa AI is an educational image studio. The frontend uses Supabase Auth and profile-backed roles, stores generation requests through protected database RPCs, and loads Founder data through Founder-authorized services. Policy classification and image-model generation are not connected yet.

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
- `/history` — The authenticated user's request history
- `/login` and `/register` — Supabase email/password authentication
- `/profile` — Authenticated account and logout
- `/access-denied` — Friendly authorization feedback
- `/founder` — Founder dashboard
- `/founder/approvals` — Founder-authorized restricted request review
- `/founder/users` — Trusted profile role/permission controls
- `/founder/activity` — Append-only audit activity
- `/founder/settings` — Server-managed categories, limits, and generation switch

## Authentication boundary

The app defaults to an injectable `supabaseAuthAdapter`. Supabase Auth handles email/password registration, sign-in, session restoration, token refresh, and sign-out. Role and permission state are loaded from the user's RLS-protected `profiles` row; missing profile data fails closed. The `demoAuthAdapter` remains available only when explicitly passed to `AuthProvider` for development/testing and is not the default. No Founder role is read from editable user metadata, and access/refresh tokens remain inside the Supabase client rather than the React context.

Route guards only control frontend navigation. Roles, permission states, approvals, and founder actions must be independently authenticated and authorized by the backend before any protected data or operation is exposed.

## Integration boundaries

The Generate action sends a prompt and category to `submit_generation_request`, which derives identity from `auth.uid()`, checks the trusted profile, global switch, category, and daily quota, then stores an unclassified pending request. The policy classifier and image model are not connected, so no image is generated and a request remains pending classification. Future handling is normal → classification → generation; restricted → classification → Founder approval/rejection; prohibited → blocked. Founder approval cannot bypass provider safeguards, platform policy, or applicable law. User history is RLS-scoped; Founder reads/writes use database-checked authorization and protected RPCs, not direct client mutation.

Demo authentication and prototype data remain available only for explicit development/testing injection; they are not the default UI path. No API keys or secret credentials belong in frontend code.
