# Privoraa AI

Privoraa AI is an educational image studio. The frontend uses Supabase Auth and profile-backed roles, stores generation requests through protected database RPCs, and loads Founder data through Founder-authorized services. Policy classification is part of the request flow; image-model generation remains intentionally disabled until Phase 10.

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

The Generate action sends a prompt and category to `submit_generation_request`, which derives identity from `auth.uid()`, checks the trusted profile, global switch, category, and daily quota, then runs a deterministic development policy classifier inside the protected database flow. Allowed requests become eligible for a future generation stage, restricted requests enter Founder approval, prohibited requests are blocked, and classifier failures fail closed. This deterministic classifier is not a substitute for a production moderation system; real provider/model integration remains a future step. No image is generated in Phase 9. Founder approval cannot bypass provider safeguards, platform policy, or applicable law. User history is RLS-scoped; Founder reads/writes use database-checked authorization and protected RPCs, not direct client mutation.

Demo authentication and prototype data remain available only for explicit development/testing injection; they are not the default UI path. No API keys or secret credentials belong in frontend code.

## Phase 10 boundary

The server-only provider boundary lives under `supabase/functions/_shared/imageProvider.js`. It accepts the normalized `generateImage({ prompt, width, height, model, userId, requestId })` contract, supports dependency-injected adapters, validates provider configuration, and accepts only normalized provider results. Missing or invalid `AI_IMAGE_PROVIDER`, `AI_IMAGE_MODEL`, or `AI_IMAGE_API_KEY` configuration fails closed. Provider failures expose only safe error codes; credentials and raw provider responses are not returned to the browser.

The Hugging Face adapter is implemented under `supabase/functions/_shared/huggingFaceProvider.js` and is used only by the authenticated `generate-image` Edge Function. The function accepts a request ID, rechecks the authenticated user, trusted profile, global generation switch, request ownership, and Phase 9 policy result, then passes the stored prompt through the provider abstraction. Browser-supplied provider, model, prompt, and user identity values are not trusted.

No model or provider credential is configured in this repository, and no live Hugging Face call has been made. Configure `AI_IMAGE_PROVIDER=huggingface`, `AI_IMAGE_MODEL=<supported-model>`, and `AI_IMAGE_API_KEY=<server-secret>` only as Supabase Edge Function secrets. Billing and paid credits remain disabled. The adapter applies a timeout, validates image content and request identity, and returns only safe normalized results or error codes. Never place these values in Vite client variables, React source, migrations, README content, tests, or tracked files.
