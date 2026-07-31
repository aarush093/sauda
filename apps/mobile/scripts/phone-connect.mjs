// @ts-check
/**
 * J4 (M4b close-out): print the exact line to open the dev build on the owner's Android phone, plus a
 * scannable QR of that URL. Run it in a second terminal while `pnpm dev:lan` (vite --host) is serving.
 *
 *   node apps/mobile/scripts/phone-connect.mjs [port=5174]
 *
 * It does NOT start a server — it only reports where the running one is reachable on the LAN. See
 * docs/PHONE_PLAYTEST.md for the Windows firewall prompt and the USB/adb fallback when the wifi
 * isolates clients (common on campus/hostel networks).
 */
import qrcode from 'qrcode-terminal';
import { networkInterfaces } from 'node:os';

const port = Number(process.argv[2] || 5174);

// Every non-internal IPv4 the machine has — the phone must be on the same one as this PC's wifi.
function lanAddresses() {
  const found = [];
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) {
        found.push({ name, address: addr.address });
      }
    }
  }
  return found;
}

const addresses = lanAddresses();
if (addresses.length === 0) {
  console.log('No LAN IPv4 address found — are you on wifi/ethernet? Use the USB/adb fallback (docs/PHONE_PLAYTEST.md).');
  process.exit(0);
}

// Prefer a private-range address (192.168 / 10. / 172.16–31) as the primary — that's the wifi LAN.
const isPrivate = (ip) => /^192\.168\./.test(ip) || /^10\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
const primary = addresses.find((a) => isPrivate(a.address)) ?? addresses[0];
const url = `http://${primary.address}:${port}/`;

console.log('\n=== SAUDA on your phone (same wifi as this PC) ===\n');
console.log(`  Open:  ${url}\n`);
qrcode.generate(url, { small: true });
console.log('\n  Windows will pop a firewall prompt for Node the first time — ALLOW it (Private networks).');
if (addresses.length > 1) {
  console.log('  Other interfaces (try these if the first does not load):');
  for (const a of addresses) {
    if (a.address !== primary.address) {
      console.log(`    http://${a.address}:${port}/   (${a.name})`);
    }
  }
}
console.log('\n  Wifi isolates clients (campus/hostel)? Use USB + adb (see docs/PHONE_PLAYTEST.md):');
console.log('    adb reverse tcp:' + port + ' tcp:' + port + '   then open  http://localhost:' + port + '/  on the phone.\n');
