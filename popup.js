const STORAGE_KEY = "skippedAds";
const DUMB_KEY = "dumbYoutube";
const PLAYABLES_KEY = "hidePlayables";
const COMMENTS_KEY = "hideComments";
const SHORTS_KEY = "hideShorts";
const SPONSORED_KEY = "hideSponsored";
const OPEN_SEARCH_KEY = "openSearch";
const SIDEBAR_KEY = "hideSidebar";
const countEl = document.getElementById("count");
const dumbToggle = document.getElementById("dumb-youtube");
const playablesToggle = document.getElementById("hide-playables");
const commentsToggle = document.getElementById("hide-comments");
const shortsToggle = document.getElementById("hide-shorts");
const sponsoredToggle = document.getElementById("hide-sponsored");
const openSearchToggle = document.getElementById("open-search");
const sidebarToggle = document.getElementById("hide-sidebar");

function render(count) {
  countEl.textContent = Number(count || 0).toLocaleString();
}

chrome.storage.local.get({
  [STORAGE_KEY]: 0,
  [DUMB_KEY]: false,
  hideSuggestions: false,
  [PLAYABLES_KEY]: true,
  [COMMENTS_KEY]: false,
  [SHORTS_KEY]: true,
  [SPONSORED_KEY]: true,
  [OPEN_SEARCH_KEY]: false,
  [SIDEBAR_KEY]: false,
}).then((data) => {
  render(data[STORAGE_KEY]);
  dumbToggle.checked = Boolean(data[DUMB_KEY] || data.hideSuggestions);
  playablesToggle.checked = Boolean(data[PLAYABLES_KEY]);
  commentsToggle.checked = Boolean(data[COMMENTS_KEY]);
  shortsToggle.checked = data[SHORTS_KEY] !== false;
  sponsoredToggle.checked = data[SPONSORED_KEY] !== false;
  openSearchToggle.checked = Boolean(data[OPEN_SEARCH_KEY]);
  sidebarToggle.checked = Boolean(data[SIDEBAR_KEY]);
});

dumbToggle.addEventListener("change", () => {
  chrome.storage.local.set({ [DUMB_KEY]: dumbToggle.checked, hideSuggestions: false });
});

playablesToggle.addEventListener("change", () => {
  chrome.storage.local.set({ [PLAYABLES_KEY]: playablesToggle.checked });
});

commentsToggle.addEventListener("change", () => {
  chrome.storage.local.set({ [COMMENTS_KEY]: commentsToggle.checked });
});

shortsToggle.addEventListener("change", () => {
  chrome.storage.local.set({ [SHORTS_KEY]: shortsToggle.checked });
});

sponsoredToggle.addEventListener("change", () => {
  chrome.storage.local.set({ [SPONSORED_KEY]: sponsoredToggle.checked });
});

openSearchToggle.addEventListener("change", () => {
  chrome.storage.local.set({ [OPEN_SEARCH_KEY]: openSearchToggle.checked });
});

sidebarToggle.addEventListener("change", () => {
  chrome.storage.local.set({ [SIDEBAR_KEY]: sidebarToggle.checked });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORAGE_KEY]) {
    render(changes[STORAGE_KEY].newValue);
  }
});

document.getElementById("reset").addEventListener("click", async () => {
  await chrome.storage.local.set({ [STORAGE_KEY]: 0 });
  await chrome.action.setBadgeText({ text: "" });
});
