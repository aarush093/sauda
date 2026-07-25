import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Plain web build for M3. Capacitor/Android packaging is M5.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
