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
const TAURI_CONF = path.resolve(ROOT, "src-tauri", "tauri.conf.json");

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

function usage() {
  console.log("Usage:");
  console.log("  node scripts/version.mjs set <x.y.z>   set version for frontend & Rust backend");
  console.log("  node scripts/version.mjs check         verify versions are in sync");
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
    const fe = setPackageJsonVersion(arg);
    const rust = setCargoVersion(arg);
    const tauri = setTauriConfVersion(arg);
    if (fe.changed) console.log(`package.json: ${fe.from} -> ${fe.to}`);
    else console.log(`package.json: already ${fe.to}`);
    if (rust.changed) console.log(`src-tauri/Cargo.toml: ${rust.from} -> ${rust.to}`);
    else console.log(`src-tauri/Cargo.toml: already ${rust.to}`);
    if (tauri.changed) console.log(`src-tauri/tauri.conf.json: ${tauri.from} -> ${tauri.to}`);
    else console.log(`src-tauri/tauri.conf.json: already ${tauri.to}`);
    console.log(`\nVersion set to ${arg}. Don't forget to update CHANGELOG.md, commit & tag v${arg}.`);
    return;
  }

  if (cmd === "check") {
    const feVersion = getPackageJsonVersion();
    const rustVersion = getCargoVersion();
    let ok = true;
    if (feVersion !== rustVersion) {
      console.error(`Version mismatch! package.json=${feVersion}, Cargo.toml=${rustVersion}`);
      ok = false;
    }
    if (fs.existsSync(TAURI_CONF)) {
      const conf = JSON.parse(read(TAURI_CONF));
      if (conf.version && conf.version !== feVersion) {
        console.error(`Version mismatch! package.json=${feVersion}, tauri.conf.json=${conf.version}`);
        ok = false;
      }
    }
    if (!ok) {
      console.error(`Run: node scripts/version.mjs set <version>`);
      process.exit(1);
    }
    console.log(`Version OK (${feVersion}) — package.json, Cargo.toml & tauri.conf.json in sync`);
    return;
  }

  usage();
  process.exit(1);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
