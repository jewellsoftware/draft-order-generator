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

const league = { name: "", nameSuggested: false, teamCount: DEFAULT_TEAMS };
let step = 1;
let rolledName = null; // last name put in the box by the dice button

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
}

function clearError() {
  els.error.textContent = "";
  els.wizard.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
}

function render() {
  const total = els.steps.length;
  els.steps.forEach((section) => {
    section.hidden = Number(section.dataset.step) !== step;
  });
  els.progress.textContent = `Step ${step} of ${total}`;
  els.back.hidden = step === 1;
  els.next.hidden = step === total;

  if (step === 2) {
    els.summary.textContent = `${league.name} · ${league.teamCount} teams`;
  }

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

els.back.addEventListener("click", () => {
  clearError();
  if (step > 1) {
    step--;
    render();
  }
});

els.leagueName.placeholder = randomLeagueName();

load();
render();
