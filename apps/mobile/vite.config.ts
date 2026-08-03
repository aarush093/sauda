import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Plain web build for M3. Capacitor/Android packaging is M5.
export default defineConfig({
  plugins: [react()],
  // `.trycloudflare.com` lets the dev server be reached through a Cloudflare quick tunnel when the
  // LAN blocks device-to-device (e.g. campus/guest Wi-Fi with client isolation) — phone testing only.
  server: { port: 5173, allowedHosts: ['.trycloudflare.com'] },
});
