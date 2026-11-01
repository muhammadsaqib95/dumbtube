// Background worker: ad counters, watch time, the toolbar badge, keyboard
// shortcuts, and moving old settings into Chrome sync.
importScripts("/src/shared/settings.js");

const { DEFAULTS, SYNCED_KEYS, PAUSE_MS, load, save, localDay } = DumbTubeSettings;

const AD_KINDS = ["sponsored", "video", "google"];
const WATCH_TICK_MS = 5000; // content scripts report watching every 5 seconds
const PAUSE_ALARM = "pause-ends";

// ---- Badge -------------------------------------------------------------------

function formatCount(count) {
  if (count <= 0) return "";
  if (count < 1000) return String(count);
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.round(count / 1000)}k`;
  return `${(count / 1000000).toFixed(1)}m`;
}

// The badge shows the ad count, or "II" while hiding is paused.
async function updateBadge() {
  const { skippedAds, pauseEndsAt } = await load({ skippedAds: 0, pauseEndsAt: 0 });
  const paused = pauseEndsAt > Date.now();
  await chrome.action.setBadgeBackgroundColor({ color: paused ? "#5f6368" : "#c5221f" });
  await chrome.action.setBadgeText({ text: paused ? "II" : formatCount(skippedAds) });
  await chrome.action.setTitle({ title: paused ? "DumbTube: hiding paused" : "DumbTube" });
}

// ---- Counters ----------------------------------------------------------------

async function addSkipped(count, kind) {
  const data = await load({ skippedAds: 0, skippedByKind: DEFAULTS.skippedByKind, skippedToday: null });
  const day = localDay();
  const byKind = { ...DEFAULTS.skippedByKind, ...data.skippedByKind };
  if (AD_KINDS.includes(kind)) byKind[kind] += count;
  await save({
    skippedAds: data.skippedAds + count,
    skippedByKind: byKind,
    skippedToday: { day, count: (data.skippedToday?.day === day ? data.skippedToday.count : 0) + count },
  });
  await updateBadge();
}

// Each YouTube tab with a playing video reports every WATCH_TICK_MS. Adding the
// time since the last report (from any tab) counts two tabs playing at once
// as one stretch of watching, not two.
async function addWatchTime() {
  const { watchedToday } = await load({ watchedToday: null });
  const day = localDay();
  const now = Date.now();
  const current = watchedToday?.day === day ? watchedToday : { day, seconds: 0, lastTick: 0 };
  const sinceLast = current.lastTick ? now - current.lastTick : WATCH_TICK_MS;
  const added = Math.min(Math.max(sinceLast, 0), WATCH_TICK_MS) / 1000;
  await save({ watchedToday: { day, seconds: Math.round((current.seconds + added) * 10) / 10, lastTick: now } });
}

// Messages from many tabs can arrive together; handle them one at a time so
// nothing is lost between reading and writing storage.
let queue = Promise.resolve();

function enqueue(task) {
  queue = queue.then(task).catch(() => {});
  return queue;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ads-skipped" && message.count > 0) {
    enqueue(() => addSkipped(message.count, message.kind)).then(() => sendResponse({}));
    return true;
  }
  if (message?.type === "watching") {
    enqueue(addWatchTime).then(() => sendResponse({}));
    return true;
  }
});

// ---- Keyboard shortcuts (see "commands" in manifest.json) -----------------------

async function togglePause() {
  const { pauseEndsAt } = await load({ pauseEndsAt: 0 });
  const resume = pauseEndsAt > Date.now();
  await save({ pauseHiding: !resume, pauseEndsAt: resume ? 0 : Date.now() + PAUSE_MS });
}

async function toggleFocusTimer() {
  const { focusTimer, focusMinutes } = await load({ focusTimer: false, focusMinutes: DEFAULTS.focusMinutes });
  await save({
    focusTimer: !focusTimer,
    focusEndsAt: focusTimer ? 0 : Date.now() + focusMinutes * 60 * 1000,
  });
}

chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-pause") togglePause();
  if (command === "toggle-focus-timer") toggleFocusTimer();
});

// Keep the badge right when a pause starts or ends, even if the worker was asleep.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.pauseEndsAt) return;
  const endsAt = Number(changes.pauseEndsAt.newValue) || 0;
  chrome.alarms.clear(PAUSE_ALARM);
  if (endsAt > Date.now()) chrome.alarms.create(PAUSE_ALARM, { when: endsAt });
  updateBadge();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== PAUSE_ALARM) return;
  await save({ pauseHiding: false, pauseEndsAt: 0 });
  await updateBadge();
});

// ---- Moving settings into Chrome sync (once per computer) -------------------------

// Before 1.4.0 every setting lived in chrome.storage.local. Copy this
// computer's switches into sync, unless another computer already did.
async function moveSettingsToSync() {
  const { movedToSync } = await chrome.storage.local.get({ movedToSync: false });
  if (movedToSync) return;
  const keys = [...SYNCED_KEYS];
  const [old, synced] = await Promise.all([chrome.storage.local.get(keys), chrome.storage.sync.get(keys)]);
  const missing = Object.fromEntries(Object.entries(old).filter(([key]) => !(key in synced)));
  if (Object.keys(missing).length) await chrome.storage.sync.set(missing);
  await chrome.storage.local.remove(keys);
  await chrome.storage.local.set({ movedToSync: true });
}

chrome.runtime.onInstalled.addListener(async () => {
  await moveSettingsToSync();
  await updateBadge();
});

chrome.runtime.onStartup.addListener(updateBadge);
