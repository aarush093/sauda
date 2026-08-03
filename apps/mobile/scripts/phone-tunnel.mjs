// @ts-check
/**
 * LANDSCAPE-3 M4: `pnpm phone` — one command that always prints the CURRENT public URL for the phone.
 *
 * Cloudflare "quick tunnel" URLs rotate on every restart, which kept stranding the owner (a dead or
 * stale URL served an error page). This helper removes the guesswork: it ensures the dev server is up,
 * (re)starts a fresh quick tunnel, waits for its public URL, and prints that URL prominently with the
 * /#/autostart deep-link and a scannable terminal QR. Leave it running — the tunnel lives as long as it
 * does; Ctrl-C tears down anything this script started.
 *
 *   node apps/mobile/scripts/phone-tunnel.mjs [port=5174]
 *
 * A stable, NON-rotating URL needs a named tunnel (a Cloudflare account + token) — out of scope here;
 * see docs/PHONE_PLAYTEST.md for that permanent-URL upgrade path.
 */
import qrcode from 'qrcode-terminal';
import { spawn } from 'node:child_process';

const PORT = Number(process.argv[2] || 5174);
const LOCAL = `http://localhost:${PORT}`;
const TUNNEL_URL = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

// A GET that counts a 404 as "up" — the dev server answers, which is all we need to know.
async function reachable(url) {
  try {
    const response = await fetch(url);
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

// Poll a predicate until it holds or the deadline passes (used to wait for the dev server to bind).
async function waitUntil(predicate, timeoutMs, everyMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, everyMs));
  }
  return false;
}

const children = [];
function shutdown(code) {
  for (const child of children) {
    try {
      child.kill();
    } catch {
      /* already gone */
    }
  }
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function main() {
  // 1) Ensure the dev server is up — reuse one the owner already started, else start it ourselves.
  if (await reachable(LOCAL)) {
    console.log(`✓ dev server already serving on ${LOCAL}`);
  } else {
    console.log(`· starting dev server (vite --host :${PORT}) …`);
    // A single trusted command string (no user input — the port is numeric) so shell:true doesn't warn
    // (DEP0190 fires only when an args ARRAY is combined with a shell).
    const dev = spawn('pnpm --filter @sauda/mobile dev:lan', { shell: true, stdio: 'ignore' });
    children.push(dev);
    const up = await waitUntil(() => reachable(LOCAL), 30000);
    if (!up) {
      console.error(`✗ dev server did not come up on ${LOCAL} within 30s — start it by hand (pnpm dev:lan) and retry.`);
      shutdown(1);
    }
    console.log(`✓ dev server up on ${LOCAL}`);
  }

  // 2) (Re)start a fresh Cloudflare quick tunnel pointed at the dev server. cloudflared logs its public
  //    URL once the edge connection registers; we watch its output for the first trycloudflare.com URL.
  console.log('· opening a Cloudflare quick tunnel …');
  const tunnel = spawn(`cloudflared tunnel --url ${LOCAL}`, { shell: true }); // trusted string — see above
  children.push(tunnel);

  let announced = false;
  function onOutput(buffer) {
    const match = String(buffer).match(TUNNEL_URL);
    if (match && !announced) {
      announced = true;
      announce(match[0]);
    }
  }
  tunnel.stdout.on('data', onOutput);
  tunnel.stderr.on('data', onOutput); // cloudflared prints the URL banner on stderr
  tunnel.on('exit', (code) => {
    if (!announced) console.error(`✗ cloudflared exited (code ${code}) before printing a URL — is it installed and online?`);
    shutdown(code ?? 0);
  });

  // If no URL appears in a reasonable window, say so rather than hang silently.
  const gotUrl = await waitUntil(() => announced, 45000);
  if (!gotUrl) {
    console.error('✗ no tunnel URL after 45s — the Cloudflare edge may be unreachable. Leaving cloudflared running; Ctrl-C to stop.');
  }
}

// Print the current public URL prominently: the plain URL, the one-tap /#/autostart deep-link, and a
// scannable QR of that deep-link (scan → straight into a game on the phone).
function announce(publicUrl) {
  const deepLink = `${publicUrl}/#/autostart`;
  console.log('\n' + '='.repeat(52));
  console.log('  SAUDA is live on the internet — open on your phone');
  console.log('='.repeat(52) + '\n');
  console.log(`  Public URL:  ${publicUrl}`);
  console.log(`  Deep-link :  ${deepLink}   (jumps straight into a game)\n`);
  qrcode.generate(deepLink, { small: true });
  console.log('\n  Scan the QR, or type the deep-link, in the phone browser (Chrome on Android is best).');
  console.log('  This quick-tunnel URL is fresh each run — leave this terminal open; Ctrl-C ends the tunnel.\n');
}

main().catch((error) => {
  console.error(error);
  shutdown(1);
});
