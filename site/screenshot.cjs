// screenshot.cjs — captures marketing-style UI screenshots using Chrome headless
// Run from project root:  node site/screenshot.cjs
// Requires a static HTTP server running at PORT (e.g. `python -m http.server 7891` from site/)
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ROOT = path.join(__dirname, '..');                        // project root
const OUT_DIR = path.join(ROOT, 'docs', 'picture');             // -> docs/picture/
const PORT = 7891;
const BASE = `http://localhost:${PORT}/index.html`;
const DPR = 2;
const BG = 'ffffff';                                            // 官网浅色主题背景

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
      `--default-background-color=${BG}ff`,
      '--virtual-time-budget=2500',
      url
    ], { stdio: 'pipe', timeout: 30000 });
    const size = fs.statSync(outPath).size;
    console.log(`✓ ${filename}  (${(size/1024).toFixed(0)} KB)`);
  } catch(e) {
    console.error(`✗ ${filename}:`, e.stderr ? e.stderr.toString().slice(0,200) : e.message);
  }
}

console.log('=== TerminalVoice Marketing Screenshots (green theme) ===\n');

// Hero（标题 + 可交互面板原型）
shot('hero.png',        'hero',      1280, 720);
// 悬浮球 7 态
shot('ball-states.png', 'ball',      1200, 420);
// 预览确认弹窗
shot('preview.png',     'preview',   1200, 420);
// 主设置窗口
shot('main-window.png', 'main',      1200, 460);
// 技术栈
shot('tech.png',        'tech',      1200, 360);
// CTA
shot('cta.png',         'cta',       1200, 380);
// 全页概览（用于 README）
shot('overview.png',    'full',      1280, 3600);

console.log('\n=== Done. Files in docs/picture/: ===');
fs.readdirSync(OUT_DIR).forEach(f => console.log('  -', f));
