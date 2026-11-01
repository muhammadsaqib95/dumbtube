// "Hide sponsored cards": ads in the home feed, search results and sidebar.
//
// Known ad elements are hidden by youtube.css and by the selector below. As a
// fallback, any card carrying a "Sponsored" label is hidden too. Searching the
// whole page for that label is the most expensive thing the extension does, so
// normally only the parts of the page that changed are searched, with a full
// pass at most every few seconds as a safety net.
(() => {
  const { register, active, setPageClass, hideElement, showHidden, sendSkipped, ownText } = DumbTube;

  const AD_SELECTOR = [
    "ytd-ad-slot-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "ytd-banner-promo-renderer",
    "ytd-statement-banner-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "ytd-promoted-sparkles-text-search-renderer",
    "ytd-promoted-video-renderer",
    "ytd-display-ad-renderer",
    "ytd-video-masthead-ad-v3-renderer",
    "ytd-primetime-promo-renderer",
    "ytd-search-pyv-renderer",
    "ytd-companion-slot-renderer",
    "ytd-action-companion-ad-renderer",
  ].join(",");

  // Elements that make up one card; the label search hides the nearest one.
  const CARD_SELECTOR = [
    "ytd-ad-slot-renderer",
    "ytd-search-pyv-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "ytd-promoted-sparkles-text-search-renderer",
    "ytd-compact-promoted-video-renderer",
    "ytd-promoted-video-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-compact-video-renderer",
    "yt-lockup-view-model",
  ].join(",");

  const CARD_WRAPPERS = "ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-video-renderer";
  const FULL_SCAN_MS = 3000;
  const MAX_CHANGED_ROOTS = 500;

  const changedRoots = new Set();
  let lastFullScan = 0;

  function requestFullScan() {
    lastFullScan = 0;
  }

  function closestCard(el) {
    let current = el;
    while (current) {
      if (current.matches?.(CARD_SELECTOR)) return current;
      // Unknown wrapper: stop at the single search result that holds the label.
      const parent = current.parentElement;
      if (parent?.id === "contents" && parent.parentElement?.matches("ytd-item-section-renderer")) return current;
      current = current.getRootNode?.().host || parent;
    }
    return null;
  }

  function findLabelledCards(root, cards) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    for (let node = root; node; node = walker.nextNode()) {
      if (node.shadowRoot) findLabelledCards(node.shadowRoot, cards);
      const text = ownText(node);
      if (text.length < 80 && /^sponsored\b/i.test(text)) {
        const card = closestCard(node);
        if (card) cards.add(card);
      }
    }
  }

  function takeScanRoots() {
    if (!document.body) return [];
    if (Date.now() - lastFullScan > FULL_SCAN_MS || changedRoots.size > MAX_CHANGED_ROOTS) {
      lastFullScan = Date.now();
      changedRoots.clear();
      return [document.body];
    }
    // Drop roots inside another root; they'd be searched twice.
    const roots = [...changedRoots].filter((el) => {
      if (!el.isConnected) return false;
      for (let p = el.parentElement; p; p = p.parentElement) if (changedRoots.has(p)) return false;
      return true;
    });
    changedRoots.clear();
    return roots;
  }

  function run() {
    const on = active("hideSponsored");
    setPageClass("hide-sponsored", on);
    if (!on) {
      showHidden("hiddenSponsored");
      requestFullScan();
      return;
    }

    const cards = new Set([...document.querySelectorAll(AD_SELECTOR)].map((el) => el.closest(CARD_WRAPPERS) || el));
    for (const root of takeScanRoots()) findLabelledCards(root, cards);

    let newlyHidden = 0;
    for (const card of cards) {
      hideElement(card, "hiddenSponsored");
      if (card.dataset.skippedAd) continue;
      card.dataset.skippedAd = "1";
      newlyHidden += 1;
    }
    if (newlyHidden > 0) sendSkipped(newlyHidden, "sponsored");
  }

  register({
    name: "sponsored",
    run,
    navigated: requestFullScan,
    settingsChanged(keys) {
      if (keys.has("hideSponsored") || keys.has("pauseEndsAt")) requestFullScan();
    },
    pageChanged(records) {
      for (const record of records) {
        for (const node of record.addedNodes) {
          const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
          if (el) changedRoots.add(el);
        }
      }
    },
  });
})();
