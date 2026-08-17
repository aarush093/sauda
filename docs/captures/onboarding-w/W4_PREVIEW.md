# W4 — Ship safely: the preview (NOT promoted)

A Vercel **preview** of HEAD (commit `dbd2085`, the W pass) is deployed. Production is untouched.

## The preview URL — confirmed LOGIN-FREE

```
https://sauda-3044o1u8f-aarushs-projects-85ab8525.vercel.app
```

- **Deployment Protection is OFF for this preview** — verified by fetching the URL **unauthenticated**:
  `curl` returns **HTTP 200** (no 302 to a Vercel login), and the body is the SAUDA SPA shell
  (`<title>SAUDA</title>`). The owner's last RELEASE-1 preview hit a Vercel auth wall; this one does not —
  it opens on any phone with no login.
- **The new W build is actually live on that URL.** The served HTML loads
  `/assets/index-ovSulIy-.js` — the unique marker for this HEAD build (distinct from the stale live
  `index-Cwz10pm6.js` and the RELEASE-1 `index-B8cF5pLJ.js`). The bundle contains the W1 rotate-screen
  string ("is played in landscape") and the W2 "In-game tips" control, and NO "watch a demo" (U3 removed).

## Driven on the preview URL itself (iPhone-landscape-style desktop profile)

- **Home** renders live with the W2 changes: the KHELO / VS FRIENDS / NIYAM doors **plus a single
  "In-game tips: On" switch, and NO "SIKHO — watch a demo" door** (the U3 watch demo is gone).
- **KHELO → setup card → DEAL** deals a real game on the live URL.
- **A just-in-time coach mark fires on the dealt game:** *"Play an action card — Drag an action card to
  the centre to play it"*, with a **"Niyam 6: Action Cards →"** link and a ✕, the board fully visible
  behind it (no scrim over the play area — non-blocking). This is the W2 onboarding working end-to-end on
  the login-free preview.
- (Driving to a literal `gameOver` needs manual drag precision the synthetic-drag automation can't commit —
  identical dev-or-prod, the same note as DEPLOY-1 / RELEASE-1. The full in-game coach behaviour is proven
  by the test suite: `onboardingLive` fires 6+ coach marks on a real engine-legal game, and the CoachMark
  integration proves the Book jump/return keeps state intact.)

## Promote / rollback (owner's call — DO NOT run automatically)

Production was **NOT** promoted. The current production deployment is `sauda-938igwwwh…` (unchanged).

```bash
# PROMOTE this exact preview build to production (the live link), when the owner approves:
npx vercel promote https://sauda-3044o1u8f-aarushs-projects-85ab8525.vercel.app

# ROLLBACK production to the deployment that is live right now (undo a promote):
npx vercel rollback https://sauda-938igwwwh-aarushs-projects-85ab8525.vercel.app
#   (or `npx vercel rollback` to revert to the immediately previous production deployment)
```

Run from the repo root (the dir is linked to the `sauda` Vercel project). A push to `master` also
auto-deploys production, so promotion stays a deliberate, owner-run step.
