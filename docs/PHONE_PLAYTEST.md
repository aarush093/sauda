# SAUDA on your Android phone (dev build)

The whole input model — the wheel scrub, drag-to-zone, tap-to-inspect — was built for **fingers**, but
every playtest so far was mouse + devtools. This gets the live dev build onto a real phone. Two paths:
**Wi-Fi (LAN)** first, and **USB (adb)** as the fallback when the network isolates clients (common on
campus/hostel Wi-Fi).

Nothing to build — it serves the same Vite dev server the desktop uses. `__replay`, `#/autostart`, the
dev routes, and all plate paths are relative/in-page, so they work identically off `localhost`.

---

## Path 0 — one command, works anywhere: `pnpm phone` (Cloudflare quick tunnel)

The fastest path, and the one to use when the phone is **not** on the same Wi-Fi (mobile data, a different
network, or a Wi-Fi that isolates clients):

```
pnpm phone
```

It ensures the dev server is up (reusing one you already started, or launching `dev:lan` itself), opens a
fresh Cloudflare quick tunnel, waits for the public `https://…trycloudflare.com` URL, and prints it
prominently with the `/#/autostart` deep-link and a **scannable terminal QR**. Scan the QR (or type the
deep-link) in the phone browser and you drop straight into a game. Leave the terminal open — the tunnel
lives as long as it runs; **Ctrl-C** ends it (and stops the dev server too, if `pnpm phone` started it).

Quick-tunnel URLs are **ephemeral** — a new one is minted every run, and a previous one goes dead. That is
exactly why this is one command: don't hunt for the old URL, just run `pnpm phone` again and use the fresh
one it prints. Needs `cloudflared` on `PATH` (already installed on the owner's PC).

**Permanent-URL upgrade path (out of scope here).** A *stable*, non-rotating hostname needs a Cloudflare
**named tunnel**, which requires a (free) Cloudflare account, a domain on Cloudflare, and a tunnel token —
you'd run `cloudflared tunnel create sauda` + `cloudflared tunnel route dns …` once, store the token, and
`pnpm phone` would point at that named tunnel instead of a quick one. That's an account/DNS setup task, so
it's deliberately left for later; the quick tunnel above needs zero account and covers playtesting today.

---

## Path A — Wi-Fi (LAN), the normal case

**Phone and PC must be on the same Wi-Fi.**

1. **Serve on the LAN** (binds to all interfaces, pinned to 5174):
   ```
   pnpm --filter @sauda/mobile dev:lan
   ```
   The first time, **Windows pops a Defender Firewall prompt for Node — click Allow** (tick *Private
   networks*). Without that, the phone can't reach the PC.

2. **Get the connect line + QR** (second terminal):
   ```
   pnpm phone:lan        # alias for: pnpm --filter @sauda/mobile phone:connect
   ```
   It prints the URL and a scannable QR, e.g. `http://192.168.x.x:5174/`. Scan it (or type the URL) in
   the phone's browser. Chrome on Android is best. (`pnpm phone` now opens the Cloudflare tunnel — Path 0.)

3. Play. Edits hot-reload on the phone just like the desktop.

If the page won't load: re-check the firewall prompt, confirm same Wi-Fi, and try the other interface
addresses `phone:connect` lists (a PC often has several — VPN/virtual adapters included).

---

## Path B — USB + adb (fallback when Wi-Fi isolates clients)

Many shared networks block phone→PC connections (client isolation). Then LAN can't work at all — use USB.

1. On the phone: **Settings → About phone → tap Build number 7×** to unlock Developer options, then
   **Developer options → enable USB debugging**. Plug into the PC; accept the "Allow USB debugging?"
   prompt.
2. Install platform-tools (adb) on the PC if needed. Confirm the phone is seen:
   ```
   adb devices
   ```
3. Serve (either `dev:lan` above or the plain `pnpm --filter @sauda/mobile dev`), then reverse the port
   so the phone's `localhost` tunnels to the PC over USB:
   ```
   adb reverse tcp:5174 tcp:5174
   ```
4. On the phone open **`http://localhost:5174/`**. No Wi-Fi involved; no firewall prompt.

`adb reverse` clears when the cable is unplugged — re-run it after replugging.

---

## Notes

- The dev build ships the DEV-only helpers (render tally, `__replay`, `#/dev/*`). That's expected for a
  playtest build; they're tree-shaken from a production (`vite build`) bundle. M5 does the Capacitor APK.
- Feature toggles for the playtest: append a query **before** the hash, e.g.
  `http://<host>:5174/?badgeFloor=1#/autostart` turns on the J3 value-badge legibility floor (default
  off — see `docs/captures/m4b-closeout/badge-floor/`).
