// screenshot.cjs — captures marketing-style UI screenshots using Chrome headless
// Run from project root:  node docs/ui-show/screenshot.cjs
// Requires a static HTTP server running at PORT (e.g. `python -m http.server 7891` from docs/ui-show)
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ROOT = path.join(__dirname, '..', '..');          // project root
const OUT_DIR = path.join(ROOT, 'docs', 'picture');      // -> docs/picture/
const PORT = 7891;
const BASE = `http://localhost:${PORT}/showcase.html`;
const DPR = 2;
const CREAM_BG = 'f3ece1';

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function shot(filename, shotParam, width, height) {
  const url = shotParam ? `${BASE}?shot=${shotParam}` : BASE;
  const outPath = path.join(OUT_DIR, filename);
  try {
    execFileSync(CHROME, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--screenshot=${outPath}`,
      `--window-size=${width},${height}`,
      `--force-device-scale-factor=${DPR}`,
      `--default-background-color=${CREAM_BG}ff`,
      '--virtual-time-budget=2500',
      url
    ], { stdio: 'pipe', timeout: 30000 });
    const size = fs.statSync(outPath).size;
    console.log(`✓ ${filename}  (${(size/1024).toFixed(0)} KB)`);
  } catch(e) {
    console.error(`✗ ${filename}:`, e.stderr ? e.stderr.toString().slice(0,200) : e.message);
  }
}

console.log('=== TerminalVoice Marketing Screenshots (ccswitch-style) ===\n');

// Hero (big title + panel mockup)
shot('hero.png',        'hero',      1280, 720);
// Desktop scene (ball + panel on mini desktop)
shot('scene.png',       'scene',     1200, 600);
// Ball 7 states
shot('ball-states.png', 'ball',      1200, 320);
// Preview popup
shot('preview.png',     'preview',   1200, 520);
// Skills tab
shot('skills.png',      'skills',    1200, 520);
// Translate popup
shot('translate.png',   'translate', 1200, 440);
// Main settings window
shot('main-window.png', 'main',      1200, 620);
// Tech chips
shot('tech.png',        'tech',      1200, 360);
// CTA banner
shot('cta.png',         'cta',       1200, 380);
// Full page (overview for README)
shot('overview.png',    'full',      1280, 3600);

console.log('\n=== Done. Files in docs/picture/: ===');
fs.readdirSync(OUT_DIR).forEach(f => console.log('  -', f));
