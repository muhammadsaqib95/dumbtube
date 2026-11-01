// Keeps the ad counters and the number on the toolbar icon.
importScripts("/src/shared/settings.js");

const { localDay } = DumbTubeSettings;

function formatBadge(count) {
  if (count <= 0) return "";
  if (count < 1000) return String(count);
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.round(count / 1000)}k`;
  return `${(count / 1000000).toFixed(1)}m`;
}

async function setBadge(count) {
  await chrome.action.setBadgeBackgroundColor({ color: "#c5221f" });
  await chrome.action.setBadgeText({ text: formatBadge(count) });
}

async function showStoredTotal() {
  const { skippedAds } = await chrome.storage.local.get({ skippedAds: 0 });
  await setBadge(skippedAds);
}

async function addSkipped(count) {
  const data = await chrome.storage.local.get({ skippedAds: 0, skippedToday: null });
  const day = localDay();
  const total = data.skippedAds + count;
  const today = (data.skippedToday?.day === day ? data.skippedToday.count : 0) + count;
  await chrome.storage.local.set({ skippedAds: total, skippedToday: { day, count: today } });
  await setBadge(total);
  return total;
}

// Messages from many tabs can arrive together; handle them one at a time so
// no count is lost between reading and writing storage.
let queue = Promise.resolve();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "ads-skipped" || !message.count) return;

  queue = queue
    .then(() => addSkipped(message.count))
    .then((total) => sendResponse({ total }))
    .catch(() => sendResponse({}));
  return true;
});

chrome.runtime.onStartup.addListener(showStoredTotal);
chrome.runtime.onInstalled.addListener(showStoredTotal);
