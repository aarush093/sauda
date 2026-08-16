# SAUDA — DEPLOY (the permanent web link)

**Goal of DEPLOY-1:** kill launch-blocker #1 — "no stable link." Before this, the only way onto
a phone was `pnpm phone`, an ephemeral Cloudflare quick tunnel that rotates every run and dies when
the laptop sleeps. This document is the one-stop guide to putting SAUDA on a permanent URL (Vercel)
and keeping it there.

SAUDA is **solo-vs-bots and 100% client-side** — a static Vite build. **No backend, no database, no
secrets.** That is why a static host is all it needs.

---

## LIVE URL

> **`https://<your-project>.vercel.app`** — _fill this in after the first deploy below._

Once deployed, the same URL is permanent. Share it, bookmark it, open it on any phone. The owner's
loop becomes: **fix → push → open the same URL on a phone.**

---

## What is already prepared (in the repo)

- **`vercel.json`** (repo root) — the whole deploy config, committed so it lives in git (not hidden in
  a dashboard):
  - `buildCommand`: `pnpm --filter @sauda/mobile build` — builds only the mobile app; the workspace
    packages (`@sauda/engine`, `@sauda/bots`, `@sauda/difficulty`) are consumed as TypeScript source
    and compiled by Vite, so nothing needs pre-building.
  - `outputDirectory`: `apps/mobile/dist` — the static site Vite emits.
  - `installCommand`: `pnpm install --frozen-lockfile` — installs the monorepo from the committed
    lockfile.
  - `rewrites`: every unmatched path → `/index.html`, so deep links resolve. (SAUDA uses **hash**
    routing — `…/#/play`, `…/#/niyam` — so the browser always requests `/` anyway; the rewrite is a
    belt-and-braces guard for any non-hash path. Real static files like `/assets/*` are served first
    and are unaffected.)
- **Dev surfaces are stripped from the production bundle** (DEPLOY-1 D1): the `#/dev/*` routes, the
  spread lab, the `?hud` overlay, and the `window.__replay/__sauda/__craft/__saudaCapturePaused`
  capture bridge are all gated behind `import.meta.env.DEV`, which Vite replaces with `false` in a
  production build — so they are dead-code-eliminated. Verified by grepping the built output (empty)
  and by checking the globals are `undefined` in the served build.
- **Asset paths are root-absolute** (`/assets/…`) and resolve correctly from a static host served at
  the domain root.

You can reproduce the exact artifact Vercel will serve, locally:

```bash
pnpm --filter @sauda/mobile build      # → apps/mobile/dist
pnpm --filter @sauda/mobile preview     # serves the built dist at http://localhost:4173
```

---

## Deploy — do this once (owner)

Vercel requires a login the owner must perform himself (it opens a browser / emails a code). This cannot be automated. There are two paths; **Path B is recommended** because it gives you
the auto-deploy-on-push loop for free.

### Path A — quickest first deploy (Vercel CLI, no GitHub needed)

Run from the repo root (`C:\Users\aarush pandit\sauda`):

```bash
npx vercel login          # pick "Continue with GitHub" or "Continue with Email", approve in browser
npx vercel --prod         # first run walks the link prompts, then builds + deploys production
```

On that first `vercel --prod`, answer the prompts:

| Prompt | Answer |
|--------|--------|
| Set up and deploy "…/sauda"? | **Y** |
| Which scope? | your own account |
| Link to existing project? | **N** |
| What's your project's name? | **sauda** (this becomes the URL: `sauda.vercel.app` if free) |
| In which directory is your code located? | **`./`** (the repo root — `vercel.json` lives here) |
| Want to modify the detected settings? | **N** — use the committed `vercel.json` |

When it finishes it prints the **Production** URL. Put that URL at the top of this file.

### Path B — GitHub + auto-deploy (recommended, enables fix → push → open)

1. Create an **empty** GitHub repo (no README/licence), e.g. `sauda`. Do **not** let tooling create
   accounts or push credentials — this is yours to do.
2. Connect it and push (from the repo root):
   ```bash
   git remote add origin https://github.com/<your-user>/sauda.git
   git push -u origin master
   ```
3. Go to **vercel.com → Add New… → Project → Import Git Repository**, pick the `sauda` repo. Vercel
   reads `vercel.json` automatically — the build command, output directory and rewrites are all set.
   Click **Deploy**.
4. Done. From now on **every `git push` auto-deploys**: a push to `master` publishes **production**
   (the live URL); a push to any other branch publishes a **preview** URL for that branch.

> **Node version note:** the repo pins Node 24 (`engines.node` in `package.json`), which is what the
> local build uses (Vercel CLI reported Node.js 24.15.0). If a Vercel build ever errors with an
> invalid Node version, set **Project Settings → General → Node.js Version → 22.x**. The app is a
> static client build with no Node-24-specific runtime needs, so 20/22 build identically.

---

## Preview vs Production — how they relate

- **Production** = the deployment from the `master` branch. This is the stable URL you share
  (`sauda.vercel.app`). Overwritten each time `master` is deployed.
- **Preview** = a throwaway URL for any other branch or pull request (`sauda-git-<branch>-…vercel.app`).
  Use these to try a change on a phone before it becomes the shared link.
- CLI equivalents: `vercel` → a preview deploy; `vercel --prod` → production.

## Rollback — if a deploy breaks the live URL

- **Dashboard (instant, no rebuild):** Vercel → the project → **Deployments** → find the last good
  one → **⋯ → Promote to Production** (a.k.a. "Rollback"). The live URL points at that build in
  seconds.
- **CLI:** `npx vercel rollback` promotes the previous production deployment.
- **Git (source of truth):** `git revert <bad-commit> && git push` — auto-deploys the reverted state
  as the new production.

Every deployment is immutable and kept, so rolling back is always available.

---

## Share it with a friend (paste this)

> **Play SAUDA — a property card game (solo vs 3 bots):**
> **https://<your-project>.vercel.app**
> Open it **on your phone** and **turn the phone sideways** (it's landscape-only — a "rotate to play"
> card will tell you). New to it? Tap **NIYAM** on the home screen for the 1-minute rules, or just hit
> **KHELO** and start on **Easy** — the in-game **Munshi** advisor (the ◈ button) will nudge you.
> Try to collect two complete colour sets to win. Takes ~10 minutes. Tell me what confused you.

_(Replace the URL after your first deploy.)_

---

## Verify a deploy is healthy

After deploying, a 30-second smoke check:

```bash
curl -sI  https://<your-project>.vercel.app/            # expect: HTTP/2 200
curl -s   https://<your-project>.vercel.app/ | grep -i "<title>"   # expect: <title>SAUDA</title>
```

Then open the URL on a phone (landscape), tap **KHELO → Easy → DEAL**, and confirm the cards deal and
the board renders. The served files are byte-for-byte the `apps/mobile/dist` you can preview locally,
so if `pnpm --filter @sauda/mobile preview` plays cleanly, the live site will too.
