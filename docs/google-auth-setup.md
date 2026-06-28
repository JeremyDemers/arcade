# Direct Google Sign-In Setup

Both games use Google Identity Services directly. Clerk is not required.

## Google Cloud

1. Create or select a Google Cloud project.
2. Complete **Google Auth Platform → Branding**.
3. Set the audience to **External** and publish the app for production use.
4. Create an OAuth client with application type **Web application**.
5. Add these authorized JavaScript origins:
   - `http://localhost:3000`
   - `http://localhost:3001`
   - Your production origin, such as `https://arcade.example.com`

Redirect URIs are not required for this Google Identity Services callback flow.

## Frontends

Create `frontend/.env.local` inside each game:

```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=123456789-example.apps.googleusercontent.com
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Neon Shatter uses `http://localhost:8001` for its API.

## Backends

Export the same Web Client ID before starting each backend:

```bash
export GOOGLE_CLIENT_ID=123456789-example.apps.googleusercontent.com
export ARCADE_SECRET=replace-with-a-long-random-production-secret
export ARCADE_ALLOWED_ORIGINS=https://arcade.example.com
```

Multiple production origins can be comma-separated. Local ports `3000` and `3001` remain enabled automatically. A Google client secret is not needed for this ID-token flow.

Arcade stores Google's stable account identifier, a leaderboard username derived from the account name, and the profile-picture URL. The verified email is used during sign-in validation but is not stored.
