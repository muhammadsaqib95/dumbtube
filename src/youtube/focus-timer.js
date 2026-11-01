// "Focus timer": pause every video once the chosen number of minutes is up.
// The popup stores the end time; this tab only waits for it.
(() => {
  const { register, settings, save } = DumbTube;

  const NOTE_ID = "focus-timer-note";
  let timerId = 0;

  function endsAt() {
    return settings.focusTimer ? Number(settings.focusEndsAt) || 0 : 0;
  }

  function timeIsUp() {
    const end = endsAt();
    return Boolean(end) && Date.now() >= end;
  }

  function showNote() {
    if (document.getElementById(NOTE_ID)) return;
    const note = document.createElement("p");
    note.id = NOTE_ID;
    note.textContent = "Focus time is up. Playback is paused.";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Keep watching";
    button.addEventListener("click", () => save({ focusTimer: false, focusEndsAt: 0 }));
    note.appendChild(button);
    document.documentElement.appendChild(note);
  }

  function hideNote() {
    document.getElementById(NOTE_ID)?.remove();
  }

  function pauseIfTimeIsUp() {
    if (!timeIsUp()) return;
    for (const video of document.querySelectorAll("video")) {
      if (!video.paused) video.pause();
    }
    showNote();
  }

  function schedule() {
    clearTimeout(timerId);
    const end = endsAt();
    if (!end || Date.now() < end) hideNote();
    if (!end) return;
    if (Date.now() >= end) pauseIfTimeIsUp();
    else timerId = setTimeout(pauseIfTimeIsUp, end - Date.now());
  }

  register({
    name: "focusTimer",
    run: pauseIfTimeIsUp,
    start() {
      // Catch videos started after time is up, including ones YouTube autoplays.
      document.addEventListener(
        "play",
        (event) => {
          if (event.target instanceof HTMLVideoElement) pauseIfTimeIsUp();
        },
        true
      );
    },
    settingsChanged(keys) {
      if (keys.has("focusTimer") || keys.has("focusEndsAt")) schedule();
    },
  });
})();
