#!/usr/bin/env node
/**
 * TerminalVoice 版本号管理脚本（Tauri 项目）。
 *
 * 同步前端（根目录 package.json）+ Rust 后端（src-tauri/Cargo.toml）的版本号。
 *
 * 用法：
 *   node scripts/version.mjs set <x.y.z>   设置新版本号
 *   node scripts/version.mjs check         校验各版本号文件一致
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const PACKAGE_JSON = path.resolve(ROOT, "package.json");
const CARGO_TOML = path.resolve(ROOT, "src-tauri", "Cargo.toml");
const CARGO_LOCK = path.resolve(ROOT, "src-tauri", "Cargo.lock");
const TAURI_CONF = path.resolve(ROOT, "src-tauri", "tauri.conf.json");
const APP_STORE = path.resolve(ROOT, "src", "stores", "appStore.ts");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function write(filePath, contents) {
  fs.writeFileSync(filePath, contents, "utf8");
}

function getPackageJsonVersion() {
  const pkg = JSON.parse(read(PACKAGE_JSON));
  if (!pkg.version || typeof pkg.version !== "string") {
    throw new Error("package.json missing valid version");
  }
  return pkg.version;
}

function setPackageJsonVersion(newVersion) {
  const original = read(PACKAGE_JSON);
  const re = /("version"\s*:\s*")([^"]*)(")/;
  const m = original.match(re);
  if (!m) throw new Error(`Cannot find "version" in package.json`);
  if (m[2] === newVersion) return { from: m[2], to: newVersion, changed: false };
  write(PACKAGE_JSON, original.replace(re, `$1${newVersion}$3`));
  return { from: m[2], to: newVersion, changed: true };
}

const CARGO_VERSION_RE = /^(version\s*=\s*")([^"]*)(")/m;

function getCargoVersion() {
  const content = read(CARGO_TOML);
  const m = content.match(CARGO_VERSION_RE);
  if (!m) throw new Error(`Cannot find version in ${CARGO_TOML}`);
  return m[2];
}

function setCargoVersion(newVersion) {
  const original = read(CARGO_TOML);
  const m = original.match(CARGO_VERSION_RE);
  if (!m) throw new Error(`Cannot find version in ${CARGO_TOML}`);
  if (m[2] === newVersion) return { from: m[2], to: newVersion, changed: false };
  write(CARGO_TOML, original.replace(CARGO_VERSION_RE, `$1${newVersion}$3`));
  return { from: m[2], to: newVersion, changed: true };
}

function setTauriConfVersion(newVersion) {
  if (!fs.existsSync(TAURI_CONF)) return { from: null, to: newVersion, changed: false };
  const original = read(TAURI_CONF);
  // tauri.conf.json 的 version 字段（productName 下方）
  const re = /("version"\s*:\s*")([^"]*)(")/;
  const m = original.match(re);
  if (!m) return { from: null, to: newVersion, changed: false };
  if (m[2] === newVersion) return { from: m[2], to: newVersion, changed: false };
  write(TAURI_CONF, original.replace(re, `$1${newVersion}$3`));
  return { from: m[2], to: newVersion, changed: true };
}

// Cargo.lock 中 [[package]] name = "terminalvoice" 段落下的 version 行（兼容 LF/CRLF）
const CARGO_LOCK_PKG_RE =
  /(\[\[package\]\]\s*[\r\n]+name\s*=\s*"terminalvoice"\s*[\r\n]+version\s*=\s*")([^"]*)(")/;

function getCargoLockVersion() {
  const content = read(CARGO_LOCK);
  const m = content.match(CARGO_LOCK_PKG_RE);
  if (!m) throw new Error(`Cannot find terminalvoice version in ${CARGO_LOCK}`);
  return m[2];
}

function setCargoLockVersion(newVersion) {
  if (!fs.existsSync(CARGO_LOCK)) return { from: null, to: newVersion, changed: false };
  const original = read(CARGO_LOCK);
  const m = original.match(CARGO_LOCK_PKG_RE);
  if (!m) throw new Error(`Cannot find terminalvoice version in ${CARGO_LOCK}`);
  if (m[2] === newVersion) return { from: m[2], to: newVersion, changed: false };
  write(CARGO_LOCK, original.replace(CARGO_LOCK_PKG_RE, `$1${newVersion}$3`));
  return { from: m[2], to: newVersion, changed: true };
}

// appStore.ts 中 appVersion 初始值与浏览器 mock 的 updateInfo.version（两处）
const APP_STORE_VERSION_RE = /(appVersion|version)\s*:\s*"([^"]*)"/g;

function getAppStoreVersions() {
  const content = read(APP_STORE);
  return [...content.matchAll(APP_STORE_VERSION_RE)].map((m) => m[2]);
}

function setAppStoreVersion(newVersion) {
  if (!fs.existsSync(APP_STORE)) return { from: null, to: newVersion, changed: false };
  const original = read(APP_STORE);
  const versions = getAppStoreVersions();
  if (versions.length === 0) {
    throw new Error(`Cannot find version strings in ${APP_STORE}`);
  }
  const from = [...new Set(versions)].join(", ") || "(none)";
  if (versions.every((v) => v === newVersion)) {
    return { from, to: newVersion, changed: false };
  }
  write(APP_STORE, original.replace(APP_STORE_VERSION_RE, `$1: "${newVersion}"`));
  return { from, to: newVersion, changed: true };
}

function usage() {
  console.log("Usage:");
  console.log("  node scripts/version.mjs set <x.y.z>   set version for frontend & Rust backend (5 files)");
  console.log("  node scripts/version.mjs check         verify versions are in sync");
}

function reportSetResult(label, result) {
  if (result.changed) console.log(`${label}: ${result.from} -> ${result.to}`);
  else console.log(`${label}: already ${result.to}`);
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  if (!cmd) {
    usage();
    process.exit(1);
  }

  if (cmd === "set") {
    if (!arg) {
      usage();
      process.exit(1);
    }
    if (!/^\d+\.\d+\.\d+$/.test(arg)) {
      console.error(`Invalid version: "${arg}" (expected x.y.z)`);
      process.exit(1);
    }
    reportSetResult("package.json", setPackageJsonVersion(arg));
    reportSetResult("src-tauri/Cargo.toml", setCargoVersion(arg));
    reportSetResult("src-tauri/Cargo.lock", setCargoLockVersion(arg));
    reportSetResult("src-tauri/tauri.conf.json", setTauriConfVersion(arg));
    reportSetResult("src/stores/appStore.ts", setAppStoreVersion(arg));
    console.log(`\nVersion set to ${arg}. Don't forget to update CHANGELOG.md, commit & tag v${arg}.`);
    return;
  }

  if (cmd === "check") {
    const feVersion = getPackageJsonVersion();
    const rustVersion = getCargoVersion();
    let ok = true;

    const mismatch = (label, actual) => {
      console.error(`Version mismatch! package.json=${feVersion}, ${label}=${actual}`);
      ok = false;
    };

    if (feVersion !== rustVersion) mismatch("Cargo.toml", rustVersion);

    if (fs.existsSync(CARGO_LOCK)) {
      const lockVersion = getCargoLockVersion();
      if (lockVersion !== feVersion) mismatch("Cargo.lock", lockVersion);
    }

    if (fs.existsSync(TAURI_CONF)) {
      const conf = JSON.parse(read(TAURI_CONF));
      if (conf.version && conf.version !== feVersion) mismatch("tauri.conf.json", conf.version);
    }

    if (fs.existsSync(APP_STORE)) {
      const storeVersions = getAppStoreVersions();
      if (storeVersions.length === 0) {
        console.error("appStore.ts: no version strings found");
        ok = false;
      } else if (storeVersions.some((v) => v !== feVersion)) {
        mismatch("appStore.ts", [...new Set(storeVersions)].join(", "));
      }
    }

    if (!ok) {
      console.error(`Run: node scripts/version.mjs set <version>`);
      process.exit(1);
    }
    console.log(`Version OK (${feVersion}) — package.json, Cargo.toml, Cargo.lock, tauri.conf.json & appStore.ts in sync`);
    return;
  }

  usage();
  process.exit(1);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
