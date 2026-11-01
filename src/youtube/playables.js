// "Hide Playables": the YouTube Playables game shelf and its sidebar entry.
(() => {
  const { register, active, hideElement, showHidden, ownText } = DumbTube;

  const SHELVES =
    "ytd-rich-shelf-renderer, ytd-horizontal-card-list-renderer, ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer";

  function shelfOf(el) {
    return el.closest(SHELVES) || el.closest("ytd-rich-section-renderer");
  }

  // A section that also holds ordinary videos is a whole feed, not the shelf.
  function holdsOtherVideos(shelf) {
    return Boolean(
      shelf.querySelector("ytd-video-renderer, ytd-compact-video-renderer") && shelf.querySelector("ytd-rich-item-renderer")
    );
  }

  function run() {
    if (!active("hidePlayables")) {
      showHidden("hiddenPlayable");
      return;
    }

    const shelves = new Set();
    for (const link of document.querySelectorAll('a[href*="playables"]')) {
      const shelf = shelfOf(link);
      if (shelf && !shelf.querySelector("ytd-rich-item-renderer ytd-rich-shelf-renderer")) shelves.add(shelf);
    }
    for (const heading of document.querySelectorAll("span, yt-formatted-string, h2")) {
      if (ownText(heading) !== "YouTube Playables") continue;
      const shelf = shelfOf(heading);
      if (shelf) shelves.add(shelf);
    }

    for (const shelf of shelves) {
      if (!holdsOtherVideos(shelf)) hideElement(shelf, "hiddenPlayable");
    }
  }

  register({ name: "playables", run });
})();
