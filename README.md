# TaskFlow Frontend — `frontend-test`

Standalone, Vercel-ready build of the TaskFlow React SPA. It is a
self-contained Vite project: no dependency on the `frontend/` folder, and it
can be imported into Vercel as its own project.

---

## What is different from `frontend/`

| Area | `frontend/` (old) | `frontend-test/` (this one) |
| --- | --- | --- |
| `vercel.json` | `env` block with a **hard-coded** `API_BASE_URL` pointing at the old backend — it overrides your dashboard value | no `env` block, so the Vercel dashboard value is used |
| SPA deep links | legacy `routes` array with `dest: /index.html` | modern `rewrites` (`source` → `destination`), the documented Vite SPA setup |
| Stale build output | `tsc -b` emitted `vite.config.js` + `vite.config.d.ts` **into the source folder**, and Vite prefers `vite.config.js` over `vite.config.ts` — so the compiled, out-of-date config was the one actually used | `tsc --noEmit` only; nothing is ever emitted next to the sources |
| `API_BASE_URL` resolution | a local `.env` file silently overrode the Vercel build variable | the real build environment always wins over the `.env` file |
| `envPrefix` | only `VITE_*` exposed to the browser | `["VITE_", "API_"]` — `API_BASE_URL` works natively, no cast needed |
| `import.meta.env` typing | `any` | typed via `ImportMetaEnv` in `src/vite-env.d.ts` |
| Security headers | none | CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` |
| Asset caching | manual route | `Cache-Control: immutable` for `/assets/*` (hashed filenames) |
| Node version | unpinned | `.nvmrc` → Node 22 |
| Build | `tsc -b` (emits files) | `npm run typecheck && vite build` (type-checks app **and** config, emits nothing) |
| Bundle | one big vendor chunk | vendor / ui / app split, no empty chunks |

---

## 1. Point it at your backend

The frontend needs exactly one setting: the base URL of the backend API.

### Option A — Vercel dashboard (recommended)

Vercel → **Project** → **Settings** → **Environment Variables** → add:

| Variable | Scope | Value |
| --- | --- | --- |
| `API_BASE_URL` | **Build and Runtime** | `https://your-backend.vercel.app/api/v1` |
| `VITE_API_BASE_URL` | optional alternative | same value — both spellings work |

> It must be a **build-time** variable: the value is baked into the
> JavaScript bundle. Changing it requires a new deployment (redeploy, not
> just a restart).

### 2. Configure Google Sign-In client ID

Google Sign-In needs an OAuth client ID baked into the bundle as
`VITE_GOOGLE_CLIENT_ID`. Get it from **Google Cloud Console → APIs &
Services → Credentials → OAuth 2.0 Client IDs**.

Add it in **Vercel → Project → Settings → Environment Variables**:

| Variable | Scope | Value |
| --- | --- | --- |
| `VITE_GOOGLE_CLIENT_ID` | **Build and Runtime** | `292952689335-....apps.googleusercontent.com` |

Also add your Vercel domain to the **Authorized JavaScript origins** and the
production callback URL to **Authorized redirect URIs** in Google Cloud
Console, otherwise Google will reject the token.

Without this variable the GSI button sends `client_id=undefined` and Google
returns `Error 400: invalid_request` (Missing required parameter: client_id).

### Option B — the `.env` file

Edit `frontend-test/.env`:

```ini
API_BASE_URL=https://your-backend.vercel.app/api/v1
```

The file is **not** git-ignored from the deployment, so an uploaded copy is
picked up as a fallback. A real environment variable always wins over it
(`vite.config.ts` checks `process.env` first, then the file).

For **local** development keep the localhost value in `.env.local` — it
overrides `.env` for `npm run dev` and is never uploaded:

```ini
# frontend-test/.env.local  (git-ignored, not deployed)
API_BASE_URL=http://localhost:8000/api/v1
VITE_DEV_API_TARGET=http://localhost:8000
```

---

## 2. Create the Vercel project

1. **Add New → Project**, import this repository.
2. **Root Directory** → `frontend-test`.
3. Framework preset → **Vite** (auto-detected).
4. Add `API_BASE_URL` as a build-time environment variable.
5. **Deploy.**

`vercel.json` configures the build command, the output directory, the SPA
rewrite and the security headers. It contains **no `env` block** on purpose —
a value defined there overrides the dashboard, which is exactly how the old
deployment ended up pointing at the wrong backend.

---

## 3. Check that the stylesheet is actually served

The single most common reason for "the auth pages have no styling" is a
**404 on the CSS asset**, not a broken Tailwind build. Tailwind itself is
fine: the compiled `dist/assets/index-*.css` contains every utility class the
login and register pages use.

Check these three things after a deploy:

1. `https://<your-frontend>.vercel.app/login` loads.
2. The browser **Network** tab shows `index-*.css` with status **200**
   (not 404).
3. The **Console** tab shows no `Refused to apply style from …` CSP message.

If the CSS request 404s, the SPA rewrite is swallowing it — check that
`vercel.json` still has `"outputDirectory": "dist"` and the `rewrites` rule
`"/(.*)" → "/index.html"`. A rewrite that also matches `/assets/*` would
replace the stylesheet with `index.html`, which looks exactly like "no CSS".

A quick local check without deploying:

```bash
npm run build
npm run preview          # http://localhost:4173/login
```

---

## 4. Local development

```bash
cd frontend-test
npm install
cp .env.example .env          # then edit it
npm run dev                   # http://localhost:5173
```

The dev server proxies `/api/*` to `http://localhost:8000`
(`VITE_DEV_API_TARGET`), so start the backend locally and the whole stack
works.

Other scripts:

```bash
npm run typecheck   # type-check src/ and vite.config.ts, emits nothing
npm run build       # typecheck + production build into dist/
npm run preview     # serve the production build locally
npm run clean       # remove dist/
```

---

## Project layout

```
frontend-test/
├── index.html            # SPA shell
├── src/
│   ├── api/              # typed fetch wrappers (client.ts holds the base URL)
│   ├── components/       # TaskWorkspace, AdminWorkspace, AssistantPanel
│   ├── context/          # AuthContext (JWT), RoleContext (identity)
│   ├── hooks/
│   ├── pages/            # Login / Register / OTP
│   ├── types/
│   ├── utils/
│   ├── App.tsx           # React Router routes
│   ├── main.tsx          # entry point
│   └── vite-env.d.ts     # typed import.meta.env
├── .env                  # build-time config (uploaded as a fallback)
├── .env.local            # local-only overrides (never uploaded)
├── .env.example
├── .nvmrc                # Node 22
├── package.json
├── tsconfig.json         # app config (noEmit)
├── tsconfig.node.json    # vite.config.ts config (noEmit)
├── vercel.json
└── vite.config.ts
```

---

## Notes

* **Deep links work.** The `rewrites` rule sends every unmatched path to
  `index.html`, so `/tasks`, `/admin` and `/assistant` can be opened directly
  or bookmarked. React Router's `BrowserRouter` picks them up.
* **Content-Security-Policy.** `connect-src` allows `https://*.vercel.app`
  (and a few other common hosts) so the browser can reach your backend. If
  you host the backend somewhere else, add that domain to `connect-src` in
  `vercel.json`, otherwise the API calls are blocked and the app looks
  frozen.
* **`.env` is build-time only.** Vite inlines the values into the bundle, so
  a redeploy is needed after changing them. Nothing secret should ever be
  put in a `VITE_*` variable.
* **`src/utils/csv.ts` is not imported anywhere** — CSV import/export is
  handled by the backend (`/tasks/import`, `/tasks/export`), so `papaparse`
  is not part of the shipped bundle.
