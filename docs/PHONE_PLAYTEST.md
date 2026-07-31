# SAUDA on your Android phone (dev build)

The whole input model — the wheel scrub, drag-to-zone, tap-to-inspect — was built for **fingers**, but
every playtest so far was mouse + devtools. This gets the live dev build onto a real phone. Two paths:
**Wi-Fi (LAN)** first, and **USB (adb)** as the fallback when the network isolates clients (common on
campus/hostel Wi-Fi).

Nothing to build — it serves the same Vite dev server the desktop uses. `__replay`, `#/autostart`, the
dev routes, and all plate paths are relative/in-page, so they work identically off `localhost`.

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
   pnpm --filter @sauda/mobile phone:connect
   ```
   It prints the URL and a scannable QR, e.g. `http://192.168.x.x:5174/`. Scan it (or type the URL) in
   the phone's browser. Chrome on Android is best.

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
