const state = {
  currentActivity: null,
  suggestedProject: null,
  focus: null,
  focusState: null,
  break: null,
  nextBreakInSeconds: 0,
  breakProgressPercent: 0,
  projects: [],
};

let expanded = false;
let pinned = true;
let feedbackTimer = null;

const byId = (id) => document.getElementById(id);

function mergeState(update) {
  Object.keys(update || {}).forEach((key) => {
    if (update[key] !== undefined) state[key] = update[key];
  });
  if (state.focus && state.focusState?.sessionId === state.focus.id) {
    state.focus = { ...state.focus, ...state.focusState };
  }
  render();
}

function durationLabel(totalSeconds) {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function focusTime() {
  if (!state.focus) return "Ready";
  if (Number.isFinite(state.focus.remainingSeconds)) return durationLabel(state.focus.remainingSeconds);
  const elapsed = Math.floor((Date.now() - new Date(state.focus.startedAt).getTime()) / 1000);
  return durationLabel(state.focus.plannedMinutes * 60 - elapsed);
}

function renderProjects() {
  const select = byId("projectSelect");
  const selected = select.value;
  select.innerHTML = '<option value="">Choose project</option>';
  (state.projects || []).forEach((project) => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name;
    select.appendChild(option);
  });
  if ([...select.options].some((option) => option.value === selected)) select.value = selected;
}

function render() {
  const activity = state.currentActivity;
  const appName = activity?.appName || "Waiting for activity";
  byId("appName").textContent = appName;
  byId("windowTitle").textContent = activity?.windowTitle || "Tracker connection is starting";
  byId("appFallback").textContent = appName.charAt(0).toUpperCase() || "A";
  const icon = byId("appIcon");
  if (activity?.iconUrl) {
    icon.src = activity.iconUrl;
    icon.style.display = "block";
    byId("appFallback").style.display = "none";
  } else {
    icon.removeAttribute("src");
    icon.style.display = "none";
    byId("appFallback").style.display = "block";
  }

  byId("focusBadge").classList.toggle("hidden", !state.focus);
  byId("focusValue").textContent = focusTime();
  const snoozedSeconds = state.break?.status === "snoozed" && state.break.dueAt
    ? Math.max(0, Math.ceil((new Date(state.break.dueAt).getTime() - Date.now()) / 1000))
    : state.nextBreakInSeconds;
  byId("breakValue").textContent = state.break?.status === "suggested"
    ? "Due now"
    : durationLabel(snoozedSeconds);
  byId("projectValue").textContent = state.suggestedProject?.name || "Unassigned";

  const focusButton = byId("focusButton");
  focusButton.textContent = state.focus ? "End focus" : "Start focus";
  byId("focusDuration").classList.toggle("hidden", Boolean(state.focus));
  const breakDue = state.break && ["suggested", "snoozed"].includes(state.break.status);
  byId("breakButton").classList.toggle("hidden", !breakDue);
  byId("snoozeButton").classList.toggle("hidden", !breakDue || state.break.status === "snoozed");
  renderProjects();
}

function feedback(message, error = false) {
  const node = byId("feedback");
  node.textContent = message;
  node.classList.remove("hidden");
  node.classList.toggle("error", error);
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => node.classList.add("hidden"), 3500);
}

byId("expandButton").addEventListener("click", () => {
  expanded = !expanded;
  byId("expandedPanel").classList.toggle("hidden", !expanded);
  byId("expandButton").textContent = expanded ? "-" : "+";
  byId("expandButton").title = expanded ? "Collapse widget" : "Expand widget";
  window.widgetAPI.setExpanded(expanded);
});

byId("pinButton").addEventListener("click", () => {
  pinned = !pinned;
  byId("pinButton").classList.toggle("active", pinned);
  window.widgetAPI.setPinned(pinned);
});
byId("hideButton").addEventListener("click", () => window.widgetAPI.hide());
byId("dashboardButton").addEventListener("click", () => window.widgetAPI.openDashboard("/"));

byId("focusButton").addEventListener("click", () => {
  if (state.focus?.id) window.widgetAPI.endFocus(state.focus.id);
  else window.widgetAPI.startFocus(Number(byId("focusDuration").value), "Widget focus session");
});

byId("tagButton").addEventListener("click", () => {
  const projectId = byId("projectSelect").value;
  if (!projectId) return feedback("Choose a project first", true);
  window.widgetAPI.quickTag(projectId, state.currentActivity?.activityId || null);
});

byId("breakButton").addEventListener("click", () => window.widgetAPI.startBreak(state.break?.id || null));
byId("snoozeButton").addEventListener("click", () => window.widgetAPI.snoozeBreak(state.break?.id || null, 15));

window.widgetAPI.onState(mergeState);
window.widgetAPI.onActionResult((result) => {
  if (result.ok) feedback(result.action === "quickTag" ? "Project rule saved" : "Action completed");
  else feedback(result.error || "Action failed", true);
});
window.widgetAPI.onWindowState((next) => {
  pinned = next.pinned;
  byId("pinButton").classList.toggle("active", pinned);
});

setInterval(() => {
  if (state.focus?.remainingSeconds > 0) state.focus.remainingSeconds -= 1;
  if (!state.break && state.nextBreakInSeconds > 0) state.nextBreakInSeconds -= 1;
  render();
}, 1000);

window.widgetAPI.ready();
render();
