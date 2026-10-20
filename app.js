"use strict";

const STORAGE_KEY = "draft-order-generator:league:v2";
const MIN_TEAMS = 2;
const MAX_TEAMS = 32;

const $ = (id) => document.getElementById(id);

const els = {
  wizard: $("wizard"),
  progress: $("progress"),
  steps: [...document.querySelectorAll(".step")],
  leagueName: $("league-name"),
  rerollName: $("reroll-name"),
  teamPresets: [...document.querySelectorAll('input[name="team-preset"]')],
  teamCustom: $("team-custom"),
  summary: $("summary"),
  teamList: $("team-list"),
  drawSummary: $("draw-summary"),
  drawControls: $("draw-controls"),
  hideResult: $("hide-result"),
  drawTime: $("draw-time"),
  generate: $("generate"),
  result: $("result"),
  revealControls: $("reveal-controls"),
  revealNext: $("reveal-next"),
  revealAll: $("reveal-all"),
  shareControls: $("share-controls"),
  copyLink: $("copy-link"),
  copyText: $("copy-text"),
  startOver: $("start-over"),
  error: $("error"),
  back: $("back"),
  next: $("next"),
};

const DEFAULT_TEAMS = 12;

// Sport-neutral words; names are built from NAME_PATTERNS.
const NAME_ADJECTIVES = [
  "Apex", "Atomic", "Blazing", "Bold", "Cosmic", "Crimson", "Electric", "Elite",
  "Emerald", "Fearless", "Golden", "Grand", "Iron", "Legendary", "Lucky", "Midnight",
  "Mighty", "Neon", "Overtime", "Platinum", "Primetime", "Rebel", "Relentless", "Rogue",
  "Royal", "Rowdy", "Savage", "Silver", "Sudden Death", "Sunday", "Thunder", "Titanium",
  "Turbo", "Twilight", "Undisputed", "Unstoppable", "Velvet", "Wild", "Wildcard", "Xtreme",
];
const NAME_NOUNS = [
  "Alliance", "Armada", "Assembly", "Brigade", "Champions", "Circuit", "Club", "Coalition",
  "Collective", "Commission", "Conference", "Council", "Crew", "Dynasty", "Federation", "Gauntlet",
  "Guild", "Gang", "Legacy", "Legends", "Order", "Rivals", "Showdown", "Society",
  "Squad", "Summit", "Syndicate", "Titans", "Underdogs", "Union",
];
const NAME_PATTERNS = [
  (adj, noun) => `${adj} ${noun}`,
  (adj, noun) => `The ${adj} ${noun}`,
  (adj, noun) => `${adj} ${noun} League`,
];

// teams[i] is draft slot i+1. A team's id is stable across reorders and gives its default name.
const league = { name: "", nameSuggested: false, teamCount: DEFAULT_TEAMS, teams: [] };
let step = 1;
let rolledName = null; // last name put in the box by the dice button
const teamRows = new Map(); // team id -> <li>, reused so focus and drag survive reordering
// Last generated order: order[i] is the team picking at slot i+1. `hidden` holds the slots not yet
// revealed, ascending; they are revealed from the last pick to the first. `at` is when it was drawn.
let draw = null;
let sharedView = false; // showing a result opened from a shared link

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomLeagueName(avoid) {
  let name;
  do {
    name = pick(NAME_PATTERNS)(pick(NAME_ADJECTIVES), pick(NAME_NOUNS));
  } while (name === avoid);
  return name;
}

// The custom box wins when filled in; otherwise use the selected preset.
function selectedTeamCount() {
  return els.teamCustom.value.trim() || els.teamPresets.find((r) => r.checked)?.value || "";
}

function syncCustomStyle() {
  els.teamCustom.classList.toggle("active", els.teamCustom.value.trim() !== "");
}

function setTeamCount(count) {
  const preset = els.teamPresets.find((r) => Number(r.value) === count);
  els.teamPresets.forEach((r) => (r.checked = r === preset));
  els.teamCustom.value = preset ? "" : String(count);
  syncCustomStyle();
}

function teamLabel(team) {
  return team.name.trim() || `Team ${team.id}`;
}

// Grow or shrink to `count` teams, keeping existing ones. New teams take the lowest free id.
function resizeTeams(count) {
  league.teams.length = Math.min(league.teams.length, count);
  const used = new Set(league.teams.map((t) => t.id));
  for (let id = 1; league.teams.length < count; id++) {
    if (!used.has(id)) league.teams.push({ id, name: "", locked: false });
  }
}

// Move the team at slot `from` to slot `to`. Locked teams never move: the unlocked teams
// shift among the unlocked slots only.
function moveTeam(from, to) {
  const teams = league.teams;
  if (from === to || teams[from].locked || teams[to].locked) return;
  const slots = teams.flatMap((t, i) => (t.locked ? [] : [i]));
  const order = slots.map((i) => teams[i]);
  const [team] = order.splice(slots.indexOf(from), 1);
  order.splice(slots.indexOf(to), 0, team);
  slots.forEach((slot, k) => (teams[slot] = order[k]));
}

// Nearest unlocked slot from `index` in direction `dir` (-1 or 1), or -1 if none.
function nextUnlockedSlot(index, dir) {
  for (let i = index + dir; i >= 0 && i < league.teams.length; i += dir) {
    if (!league.teams[i].locked) return i;
  }
  return -1;
}

function createTeamRow(team) {
  const row = document.createElement("li");
  row.className = "team";
  row.innerHTML = `
    <button type="button" class="drag-handle" aria-label="Move team">⠿</button>
    <span class="slot"></span>
    <input type="text" maxlength="40" autocomplete="off" aria-label="Team name">
    <button type="button" class="lock"></button>`;
  const handle = row.querySelector(".drag-handle");
  const input = row.querySelector("input");
  const lock = row.querySelector(".lock");

  input.value = team.name;
  input.placeholder = `Team ${team.id}`;
  input.addEventListener("input", () => {
    team.name = input.value;
    input.removeAttribute("aria-invalid");
  });

  lock.addEventListener("click", () => {
    team.locked = !team.locked;
    renderTeams();
  });

  handle.addEventListener("keydown", (e) => {
    const dir = { ArrowUp: -1, ArrowDown: 1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    const from = league.teams.indexOf(team);
    const to = nextUnlockedSlot(from, dir);
    if (to < 0) return;
    moveTeam(from, to);
    renderTeams();
    handle.focus();
  });

  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    startDrag(team, row);
  });

  return row;
}

// Rows snap into place as the pointer passes over them. Listens on window rather than using
// pointer capture, because reordering moves the dragged row in the DOM, which drops capture.
function startDrag(team, row) {
  row.classList.add("dragging");
  document.body.classList.add("drag-active");

  const onMove = (e) => {
    const rows = league.teams.map((t) => teamRows.get(t.id));
    let to = rows.findIndex((r) => e.clientY <= r.getBoundingClientRect().bottom);
    if (to < 0) to = rows.length - 1;
    moveTeam(league.teams.indexOf(team), to);
    renderTeams();
  };
  const onUp = () => {
    row.classList.remove("dragging");
    document.body.classList.remove("drag-active");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}

// Create, remove and reorder rows to match league.teams.
function renderTeams() {
  const ids = new Set(league.teams.map((t) => t.id));
  for (const [id, row] of teamRows) {
    if (!ids.has(id)) {
      row.remove();
      teamRows.delete(id);
    }
  }
  league.teams.forEach((team, i) => {
    let row = teamRows.get(team.id);
    if (!row) {
      row = createTeamRow(team);
      teamRows.set(team.id, row);
    }
    const current = els.teamList.children[i];
    if (current !== row) els.teamList.insertBefore(row, current ?? null);

    row.classList.toggle("locked", team.locked);
    row.querySelector(".slot").textContent = i + 1;
    row.querySelector(".drag-handle").disabled = team.locked;
    const lock = row.querySelector(".lock");
    lock.textContent = team.locked ? "🔒" : "🔓";
    lock.setAttribute("aria-pressed", String(team.locked));
    lock.setAttribute("aria-label", `Lock in spot ${i + 1}`);
    lock.title = team.locked ? `Locked in spot ${i + 1}` : `Lock in spot ${i + 1}`;
  });
}

// Unbiased random integer in [0, n), from the browser's cryptographic RNG.
function randomInt(n) {
  const limit = Math.floor(2 ** 32 / n) * n;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % n;
}

// Fisher-Yates shuffle of the unlocked teams across the unlocked slots; locked teams keep theirs.
function drawOrder() {
  const order = [...league.teams];
  const slots = order.flatMap((t, i) => (t.locked ? [] : [i]));
  for (let k = slots.length - 1; k > 0; k--) {
    const j = randomInt(k + 1);
    [order[slots[k]], order[slots[j]]] = [order[slots[j]], order[slots[k]]];
  }
  return order;
}

function formatTime(at) {
  return new Date(at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "long" });
}

function renderDraw(justRevealed = []) {
  const teams = draw?.order ?? league.teams;
  const locked = teams.filter((t) => t.locked).length;
  els.drawSummary.textContent =
    `${draw?.leagueName ?? league.name} · ${teams.length} teams` + (locked ? ` · ${locked} locked` : "");
  els.drawControls.hidden = sharedView;
  els.startOver.hidden = !sharedView;
  els.generate.textContent = draw ? "Generate again" : "Generate draft order";
  els.drawTime.hidden = !draw;
  els.result.hidden = !draw;
  // Copying is only offered once everything is revealed, so it can't spoil a reveal.
  els.revealControls.hidden = !draw || draw.hidden.length === 0;
  els.shareControls.hidden = !draw || draw.hidden.length > 0;
  if (!draw) return;

  els.drawTime.textContent = `Generated ${formatTime(draw.at)}`;
  els.result.replaceChildren(
    ...draw.order.map((team, i) => {
      const hidden = draw.hidden.includes(i);
      const item = document.createElement("li");
      item.className = "pick";
      item.classList.toggle("locked", team.locked);
      item.classList.toggle("hidden", hidden);
      item.classList.toggle("next", i === draw.hidden.at(-1));
      item.classList.toggle("revealed", justRevealed.includes(i));
      const slot = document.createElement("span");
      slot.className = "slot";
      slot.textContent = i + 1;
      const name = document.createElement("span");
      name.className = "name";
      // Hidden names are drawn as a covered bar; the text stays for screen readers.
      name.textContent = hidden ? "Hidden" : teamLabel(team) + (team.locked ? " 🔒" : "");
      item.append(slot, name);
      return item;
    })
  );
  if (draw.hidden.length) els.revealNext.textContent = `Reveal pick ${draw.hidden.at(-1) + 1}`;
  els.result.querySelector(".revealed")?.scrollIntoView({ block: "nearest" });
}

function resultText() {
  const lines = draw.order.map((t, i) => `${i + 1}. ${teamLabel(t)}${t.locked ? " (locked)" : ""}`);
  return `${draw.leagueName} draft order\nGenerated ${formatTime(draw.at)}\n\n${lines.join("\n")}\n`;
}

// The result travels in the URL hash as base64url JSON, so sharing needs no server.
function resultLink() {
  const json = JSON.stringify({
    name: draw.leagueName,
    at: draw.at,
    picks: draw.order.map((t) => [teamLabel(t), t.locked ? 1 : 0]),
  });
  const bytes = new TextEncoder().encode(json);
  const code = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${location.origin}${location.pathname}#r=${code}`;
}

// A shared link (#r=...) opens straight to its result, fully revealed and read-only.
function readSharedResult() {
  const code = new URLSearchParams(location.hash.slice(1)).get("r");
  if (!code) return null;
  try {
    const bytes = Uint8Array.from(atob(code.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    const valid =
      typeof data.name === "string" &&
      Number.isFinite(data.at) &&
      Array.isArray(data.picks) &&
      data.picks.length >= MIN_TEAMS &&
      data.picks.length <= MAX_TEAMS &&
      data.picks.every((p) => Array.isArray(p) && typeof p[0] === "string");
    if (!valid) return null;
    return {
      leagueName: data.name.slice(0, 60),
      at: data.at,
      hidden: [],
      order: data.picks.map(([name, locked], i) => ({ id: i + 1, name: name.slice(0, 40), locked: !!locked })),
    };
  } catch {
    return null;
  }
}

async function copy(button, text) {
  button.dataset.label ??= button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied!";
  } catch {
    button.textContent = "Copy failed";
  }
  setTimeout(() => (button.textContent = button.dataset.label), 1500);
}

// Each step validates its inputs and copies them into `league`.
// Returns an error message and the offending input, or null when valid.
const validators = {
  1() {
    const count = Number(selectedTeamCount());
    if (!Number.isInteger(count) || count < MIN_TEAMS || count > MAX_TEAMS) {
      return { message: `Number of teams must be ${MIN_TEAMS}–${MAX_TEAMS}.`, input: els.teamCustom };
    }

    // A blank name takes the suggestion shown as the placeholder, but the box stays blank.
    // Blank or an unedited roll counts as suggested, so a reload shows it as a placeholder.
    const typed = els.leagueName.value.trim();
    league.name = typed || els.leagueName.placeholder;
    league.nameSuggested = !typed || typed === rolledName;
    league.teamCount = count;
    resizeTeams(count);
    return null;
  },

  // Names are synced on input; a blank name uses its "Team N" default. Names must be unique.
  2() {
    const seen = new Set();
    for (const team of league.teams) {
      const key = teamLabel(team).toLowerCase();
      if (seen.has(key)) {
        const input = teamRows.get(team.id).querySelector("input");
        return { message: `Two teams are named "${teamLabel(team)}".`, input };
      }
      seen.add(key);
    }
    return null;
  },
};

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(league));
  } catch {
    // Storage unavailable (private mode etc.); not essential.
  }
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return;
    league.name = saved.name ?? "";
    league.nameSuggested = saved.nameSuggested ?? false;
    league.teamCount = saved.teamCount ?? DEFAULT_TEAMS;
    if (Array.isArray(saved.teams)) {
      league.teams = saved.teams.map((t) => ({ id: t.id, name: t.name ?? "", locked: !!t.locked }));
    }
  } catch {
    // Ignore corrupt or unavailable storage.
  }
  // A suggested name comes back as the suggestion, never as typed text.
  if (league.nameSuggested) {
    if (league.name) els.leagueName.placeholder = league.name;
  } else {
    els.leagueName.value = league.name;
  }
  setTeamCount(league.teamCount);
  resizeTeams(league.teamCount);
}

function clearError() {
  els.error.textContent = "";
  els.wizard.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
}

// One bar segment per step: done, current, or still to come.
function renderProgress() {
  els.progress.replaceChildren(
    ...els.steps.map((section, i) => {
      const n = i + 1;
      const item = document.createElement("li");
      item.textContent = `${n}. ${section.dataset.title}`;
      item.classList.toggle("done", n < step);
      item.classList.toggle("current", n === step);
      if (n === step) item.setAttribute("aria-current", "step");
      return item;
    })
  );
  els.progress.setAttribute("aria-label", `Progress: step ${step} of ${els.steps.length}`);
}

function render() {
  const total = els.steps.length;
  els.steps.forEach((section) => {
    section.hidden = Number(section.dataset.step) !== step;
  });
  renderProgress();
  els.progress.hidden = sharedView;
  els.back.hidden = step === 1 || sharedView;
  els.next.hidden = step === total;

  if (step === 2) {
    els.summary.textContent = `${league.name} · ${league.teamCount} teams`;
    renderTeams();
  }
  // Leaving the draw step discards the result, since the teams may change.
  if (step === 3) renderDraw();
  else draw = null;

  const first = els.steps[step - 1].querySelector("input");
  if (first) first.focus();
}

els.wizard.addEventListener("submit", (e) => {
  e.preventDefault();
  clearError();

  const result = validators[step]?.();
  if (result) {
    els.error.textContent = result.message;
    result.input.setAttribute("aria-invalid", "true");
    result.input.focus();
    return;
  }

  save();
  if (step < els.steps.length) {
    step++;
    render();
  }
});

// Rolling fills the box with a fresh name; it still counts as a suggestion unless edited.
els.rerollName.addEventListener("click", () => {
  rolledName = randomLeagueName(els.leagueName.value.trim() || els.leagueName.placeholder);
  els.leagueName.placeholder = rolledName;
  els.leagueName.value = rolledName;
  els.leagueName.removeAttribute("aria-invalid");
});

// Entering a custom count clears the preset chips; picking a chip clears the custom box.
// Emptying the custom box falls back to the default chip.
els.teamCustom.addEventListener("input", () => {
  if (els.teamCustom.value.trim()) {
    els.teamPresets.forEach((r) => (r.checked = false));
    syncCustomStyle();
  } else {
    setTeamCount(DEFAULT_TEAMS);
  }
});
els.teamPresets.forEach((r) =>
  r.addEventListener("change", () => {
    els.teamCustom.value = "";
    syncCustomStyle();
  })
);

// Locked teams are never hidden: their slot is already known.
els.generate.addEventListener("click", () => {
  const order = drawOrder();
  const hidden = els.hideResult.checked ? order.flatMap((t, i) => (t.locked ? [] : [i])) : [];
  draw = { order, hidden, leagueName: league.name, at: Date.now() };
  renderDraw(hidden.length ? [] : order.map((_, i) => i));
  if (hidden.length) els.revealNext.focus();
});
els.revealNext.addEventListener("click", () => {
  const slot = draw.hidden.pop();
  renderDraw([slot]);
  if (draw.hidden.length) els.revealNext.focus();
  else els.generate.focus();
});
els.revealAll.addEventListener("click", () => {
  const slots = draw.hidden;
  draw.hidden = [];
  renderDraw(slots);
  els.generate.focus();
});

els.copyLink.addEventListener("click", () => copy(els.copyLink, resultLink()));
els.copyText.addEventListener("click", () => copy(els.copyText, resultText()));

els.back.addEventListener("click", () => {
  clearError();
  if (step > 1) {
    step--;
    render();
  }
});

els.leagueName.placeholder = randomLeagueName();

load();
draw = readSharedResult();
if (draw) {
  sharedView = true;
  step = 3;
}
render();
// Pasting another shared link into this tab only changes the hash; reload to show it.
window.addEventListener("hashchange", () => location.reload());
