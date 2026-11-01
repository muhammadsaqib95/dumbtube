import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const EXTENSION_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

// Branded Google Chrome no longer loads unpacked extensions from the command
// line, so tests need Chromium or Chrome for Testing.
function playwrightCache() {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) return process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (process.platform === "darwin") return path.join(os.homedir(), "Library/Caches/ms-playwright");
  if (process.platform === "win32") return path.join(process.env.LOCALAPPDATA || "", "ms-playwright");
  return path.join(os.homedir(), ".cache/ms-playwright");
}

export function findBrowser() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  try {
    const bundled = chromium.executablePath();
    if (fs.existsSync(bundled)) return bundled;
  } catch {}

  const cache = playwrightCache();
  const builds = fs.existsSync(cache)
    ? fs.readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => b.split("-")[1] - a.split("-")[1])
    : [];
  const candidates = [
    "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    "chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
    "chrome-linux64/chrome",
    "chrome-linux/chrome",
    "chrome-win64/chrome.exe",
    "chrome-win/chrome.exe",
  ];
  for (const build of builds) {
    for (const rel of candidates) {
      const full = path.join(cache, build, rel);
      if (fs.existsSync(full)) return full;
    }
  }
  throw new Error("No Chromium found. Run `npx playwright install chromium` in tests/, or set CHROME_PATH.");
}

// Starts a fresh browser profile with the extension loaded.
export async function launch({ settings = {}, viewport = { width: 1280, height: 800 } } = {}) {
  const ctx = await chromium.launchPersistentContext("", {
    executablePath: findBrowser(),
    headless: true,
    viewport,
    userAgent: DESKTOP_UA,
    args: [
      `--disable-extensions-except=${EXTENSION_DIR}`,
      `--load-extension=${EXTENSION_DIR}`,
      "--headless=new",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker"));
  const extensionId = new URL(sw.url()).host;
  // Playwright can hand over the worker before its script has run (seen on
  // slower CI machines). Wait until background.js has loaded settings.js.
  for (let i = 0; ; i += 1) {
    const ready = await sw.evaluate(() => typeof DumbTubeSettings !== "undefined").catch(() => false);
    if (ready) break;
    if (i >= 100) throw new Error("The extension's service worker never finished starting");
    await wait(100);
  }
  // Go through the extension's own settings layer so each key lands in the
  // right storage area (sync or local).
  const store = (values) => sw.evaluate((v) => DumbTubeSettings.save(v), values);
  const read = (defaults) => sw.evaluate((d) => DumbTubeSettings.load(d), defaults);
  if (Object.keys(settings).length) await store(settings);
  return { ctx, sw, extensionId, store, read };
}

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Tiny pass/fail reporter. `skip` is for live checks YouTube didn't give us a
// chance to run (for example, no ad was served).
const results = { pass: 0, fail: 0, skip: 0 };

export function check(name, ok, detail = "") {
  results[ok ? "pass" : "fail"] += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

export function skip(name, reason) {
  results.skip += 1;
  console.log(`SKIP  ${name}  (${reason})`);
}

export function section(title) {
  console.log(`\n${title}`);
}

export function finish() {
  console.log(`\n${results.pass} passed, ${results.fail} failed${results.skip ? `, ${results.skip} skipped` : ""}`);
  process.exitCode = results.fail ? 1 : 0;
}

// Silent 8-bit WAV. A <video> can play it, and it has a real duration, which
// is all the ad-skipping code needs.
export function wav(seconds) {
  const rate = 8000;
  const n = rate * seconds;
  const b = Buffer.alloc(44 + n);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate, 28);
  b.writeUInt16LE(1, 32);
  b.writeUInt16LE(8, 34);
  b.write("data", 36);
  b.writeUInt32LE(n, 40);
  b.fill(128, 44);
  return b;
}

// Serves a WAV with byte-range support so the browser can seek inside it.
export function fulfillWav(route, seconds = 30) {
  const body = wav(seconds);
  const range = route.request().headers()["range"];
  if (!range) return route.fulfill({ body, contentType: "audio/wav", headers: { "accept-ranges": "bytes" } });
  const [a, b] = range.replace("bytes=", "").split("-");
  const start = Number(a);
  const end = b ? Number(b) : body.length - 1;
  return route.fulfill({
    status: 206,
    body: body.subarray(start, end + 1),
    contentType: "audio/wav",
    headers: { "accept-ranges": "bytes", "content-range": `bytes ${start}-${end}/${body.length}` },
  });
}
