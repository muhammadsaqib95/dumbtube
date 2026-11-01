// "Hide Shorts": Shorts shelves, Shorts videos in feeds, and the Shorts tab.
// youtube.css hides the shelves it can name; this catches the rest.
(() => {
  const { register, active, setPageClass, hideElement, showHidden } = DumbTube;

  const SHORTS_LINKS = "a#thumbnail[href*='/shorts/'], a.shortsLockupViewModelHostEndpoint[href*='/shorts/']";
  const VIDEO_CARDS =
    "ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, yt-lockup-view-model";
  const SHORTS_SHELVES = "ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts], grid-shelf-view-model";
  const TABS = "yt-tab-shape, tp-yt-paper-tab";

  function run() {
    const on = active("hideShorts");
    setPageClass("hide-shorts", on);
    if (!on) {
      showHidden("hiddenShort");
      return;
    }

    for (const link of document.querySelectorAll(SHORTS_LINKS)) {
      const card = link.closest(VIDEO_CARDS);
      if (card) hideElement(card, "hiddenShort");
    }
    for (const shelf of document.querySelectorAll(SHORTS_SHELVES)) hideElement(shelf, "hiddenShort");
    for (const tab of document.querySelectorAll(TABS)) {
      if (tab.textContent.trim().toLowerCase() === "shorts") hideElement(tab, "hiddenShort");
    }
  }

  register({ name: "shorts", run });
})();
