/**
 * DEV-ONLY, build-time script (not shipped, not imported by the app). Fetches
 * minimal text-subset woff2 files from the Google Fonts API ONCE and writes them
 * into src/assets/fonts/ so the app can self-host them. The running app never
 * touches any CDN — it loads the bundled woff2 via local @font-face.
 *
 * Re-run only when the character set changes:  node scripts/fetch-fonts.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FONT_DIR = join(HERE, '..', 'src', 'assets', 'fonts');

// The exact glyphs the UI can render: latin letters/digits, the symbols we use,
// and the only Devanagari we show ("सौदा" / "सौ"). Subsetting to just these keeps
// all five faces well under the 120 KB budget.
const LATIN =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ₹·—–-/%()·.,:!?&+×✓●○★';
const DEVANAGARI = 'सौदाौ'; // सौदा (Sauda) + monogram
const TEXT = LATIN + DEVANAGARI;

// family label -> {css family query, output basename, weights}
const FAMILIES = [
  { query: 'Baloo+2:wght@700', weights: [700], base: 'baloo2' },
  { query: 'Karla:wght@400;700', weights: [400, 700], base: 'karla' },
  { query: 'IBM+Plex+Mono:wght@500;700', weights: [500, 700], base: 'ibmplexmono' },
];

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

async function main() {
  mkdirSync(FONT_DIR, { recursive: true });
  const families = FAMILIES.map((f) => `family=${f.query}`).join('&');
  const url = `https://fonts.googleapis.com/css2?${families}&text=${encodeURIComponent(TEXT)}&display=swap`;

  const cssResponse = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!cssResponse.ok) {
    throw new Error(`CSS fetch failed: ${cssResponse.status}`);
  }
  const css = await cssResponse.text();

  // Each @font-face block gives us a family, a weight, and a woff2 url.
  const blocks = css.split('@font-face').slice(1);
  let total = 0;
  for (const block of blocks) {
    const family = /font-family:\s*'([^']+)'/.exec(block)?.[1];
    const weight = /font-weight:\s*(\d+)/.exec(block)?.[1];
    const src = /src:\s*url\(([^)]+)\)\s*format\('woff2'\)/.exec(block)?.[1];
    if (!family || !weight || !src) {
      continue;
    }
    const base = FAMILIES.find((f) => f.query.toLowerCase().startsWith(family.toLowerCase().replace(/\s+/g, '+')))?.base;
    const safeBase = base ?? family.toLowerCase().replace(/\s+/g, '');
    const fileName = `${safeBase}-${weight}.woff2`;
    const bytes = new Uint8Array(await (await fetch(src, { headers: { 'User-Agent': UA } })).arrayBuffer());
    writeFileSync(join(FONT_DIR, fileName), bytes);
    total += bytes.length;
    console.log(`wrote ${fileName}  ${(bytes.length / 1024).toFixed(1)} KB`);
  }
  console.log(`total ${(total / 1024).toFixed(1)} KB (budget 120 KB)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
