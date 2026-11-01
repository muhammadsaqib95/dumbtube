// Page layout switches: "Dumb YouTube", "Hide comments", "Hide the sidebar"
// and "Open on search". The hiding itself is CSS in youtube.css.
(() => {
  const { register, settings, active, paused, setPageClass } = DumbTube;

  const NOTE_ID = "dumb-yt-note";
  let focusedSearchUrl = "";

  function dumbYoutubeOn() {
    return Boolean(settings.dumbYoutube || settings.hideSuggestions) && !paused();
  }

  // With the feed hidden, the home page would be blank; say what to do instead.
  function syncEmptyFeedNote(on) {
    const onFeed = location.pathname === "/" || location.pathname.startsWith("/feed/subscriptions");
    const note = document.getElementById(NOTE_ID);
    if (!on || !onFeed) {
      note?.remove();
      return;
    }
    if (note) return;
    const created = document.createElement("p");
    created.id = NOTE_ID;
    created.textContent = "Search for a topic to watch a video.";
    document.documentElement.appendChild(created);
  }

  function findSearchInput() {
    const direct = document.querySelector("#search-input input, input#search, input[name='search_query']");
    if (direct) return direct;
    for (const host of document.querySelectorAll("yt-searchbox, ytd-searchbox")) {
      const input = host.shadowRoot?.querySelector("input");
      if (input) return input;
    }
    return null;
  }

  // Focus the search box once per visit to the home page.
  function focusSearch() {
    if (!settings.openSearch || location.pathname !== "/") {
      focusedSearchUrl = "";
      return;
    }
    if (focusedSearchUrl === location.href) return;
    const input = findSearchInput();
    if (!input) return;
    focusedSearchUrl = location.href;
    input.focus();
  }

  function run() {
    const dumb = dumbYoutubeOn();
    setPageClass("dumb-youtube", dumb);
    syncEmptyFeedNote(dumb);
    setPageClass("hide-comments", active("hideComments"));
    setPageClass("hide-sidebar", active("hideSidebar"));
    focusSearch();
  }

  register({
    name: "pageLayout",
    run,
    settingsChanged(keys) {
      if (keys.has("openSearch")) focusedSearchUrl = "";
    },
  });
})();
