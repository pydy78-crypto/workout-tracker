const STORAGE_KEY = "workout-tracker.sessions";

const form = document.querySelector("#workout-form");
const dateInput = document.querySelector("#workout-date");
const copySourceDateInput = document.querySelector("#copy-source-date");
const exerciseList = document.querySelector("#exercise-list");
const exerciseTemplate = document.querySelector("#exercise-template");
const formTitle = document.querySelector("#form-title");
const saveWorkoutButton = document.querySelector("#save-workout");
const addExerciseButton = document.querySelector("#add-exercise");
const copyWorkoutButton = document.querySelector("#copy-workout");
const clearFormButton = document.querySelector("#clear-form");
const clearHistoryButton = document.querySelector("#clear-history");
const exportHistoryButton = document.querySelector("#export-history");
const importStatus = document.querySelector("#import-status");
const pasteDataInput = document.querySelector("#paste-data");
const importPasteButton = document.querySelector("#import-paste");
const historyContainer = document.querySelector("#workout-history");
const emptyState = document.querySelector("#empty-state");
const todayDateLabel = document.querySelector("#today-date-label");
const dailyTableBody = document.querySelector("#daily-table-body");
const dailyTableWrap = document.querySelector("#daily-table-wrap");
const dailyTableEmpty = document.querySelector("#daily-table-empty");
const progressMonthInput = document.querySelector("#progress-month");
const weeklyProgress = document.querySelector("#weekly-progress");
const monthWorkouts = document.querySelector("#month-workouts");
const progressEmpty = document.querySelector("#progress-empty");
const equipmentGraph = document.querySelector("#equipment-graph");
const exerciseProgress = document.querySelector("#exercise-progress");
const statWorkouts = document.querySelector("#stat-workouts");
const statSets = document.querySelector("#stat-sets");
const headerBand = document.querySelector(".header-band");
const tabTargets = document.querySelectorAll("[data-tab-target]");
const tabPanels = document.querySelectorAll("[data-tab-panel]");
const formPanel = document.querySelector("[data-form-panel]");
const diaryPanel = document.querySelector("[data-diary-panel]");

const TRACKED_EQUIPMENT = [
  "Hammer Strength MTS Incline Press",
  "Hammer Strength MTS High Row",
  "Hammer Strength MTS Row",
  "Hammer Strength Seated Calf machine",
  "Back Extension",
  "Seated Cable Row station",
  "Captain's Chair",
  "Seated Leg Curl",
  "Hammer Strength MTS Kneeling Leg Curl",
  "HIP ABDUCTION",
  "HIP ADDUCTION",
  "Leg Extension",
  "Hammer Strength Iso-Lateral Leg Press",
  "Lat Pulldown",
  "Plank",
  "Side Plank"
];

const EQUIPMENT_ALIASES = [
  { match: "low row seated cable row", equipment: "Seated Cable Row station" },
  { match: "seated cable row", equipment: "Seated Cable Row station" },
  { match: "captains chair vertical knee raise", equipment: "Captain's Chair" },
  { match: "vertical knee raise", equipment: "Captain's Chair" },
  { match: "prestige strength seated leg curl", equipment: "Seated Leg Curl" },
  { match: "back extension", equipment: "Back Extension" },
  { match: "leg extension", equipment: "Leg Extension" },
  { match: "iso lateral leg press", equipment: "Hammer Strength Iso-Lateral Leg Press" },
  { match: "hip abduction", equipment: "HIP ABDUCTION" },
  { match: "hip adduction", equipment: "HIP ADDUCTION" },
  { match: "lat pulldown", equipment: "Lat Pulldown" },
  { match: "side plank", equipment: "Side Plank" },
  { match: "plank", equipment: "Plank" }
];

const NO_WEIGHT_EQUIPMENT = new Set([
  "Captain's Chair",
  "Plank",
  "Side Plank"
]);

const EQUIPMENT_KEYWORDS = [
  "barbell",
  "dumbbells",
  "dumbbell",
  "kettlebells",
  "kettlebell",
  "machine",
  "cable",
  "band",
  "bands",
  "bodyweight",
  "smith machine",
  "ez bar",
  "trap bar",
  "bench"
];

let sessions = loadSessions();
let editingSessionId = "";
repairTimezoneRollover();

function loadSessions() {
  try {
    const savedSessions = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];

    return savedSessions.map((session) => normalizeSession(session));
  } catch {
    return [];
  }
}

function saveSessions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function localDateISO(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function todayISO() {
  return localDateISO();
}

function repairTimezoneRollover() {
  const localToday = localDateISO();
  const utcToday = new Date().toISOString().slice(0, 10);

  if (localToday === utcToday || utcToday < localToday) {
    return;
  }

  const rolloverSession = sessions.find((session) => toISODate(session.date) === utcToday);
  const localSession = sessions.find((session) => toISODate(session.date) === localToday);

  if (!rolloverSession) {
    return;
  }

  if (localSession) {
    localSession.exercises = [...localSession.exercises, ...rolloverSession.exercises];
    sessions = sessions.filter((session) => session.id !== rolloverSession.id);
  } else {
    rolloverSession.date = localToday;
  }

  saveSessions();
}

function currentMonth() {
  return todayISO().slice(0, 7);
}

function toISODate(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return "";
  }

  const isoMatch = trimmed.match(/\b(?<year>\d{4})-(?<month>\d{1,2})-(?<day>\d{1,2})\b/);
  const slashMatch = trimmed.match(/\b(?<month>\d{1,2})[/-](?<day>\d{1,2})(?:[/-](?<year>\d{2,4}))?\b/);

  if (isoMatch?.groups) {
    return [
      isoMatch.groups.year.padStart(4, "20"),
      isoMatch.groups.month.padStart(2, "0"),
      isoMatch.groups.day.padStart(2, "0")
    ].join("-");
  }

  if (slashMatch?.groups) {
    const year = slashMatch.groups.year
      ? slashMatch.groups.year.padStart(4, "20")
      : new Date().getFullYear().toString();

    return [
      year,
      slashMatch.groups.month.padStart(2, "0"),
      slashMatch.groups.day.padStart(2, "0")
    ].join("-");
  }

  return "";
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${toISODate(date) || todayISO()}T00:00:00`));
}

function addExercise(exercise = {}) {
  const node = exerciseTemplate.content.firstElementChild.cloneNode(true);
  const equipmentSelect = node.querySelector(".exercise-equipment");
  const equipment = canonicalEquipmentName(exercise.equipment || exercise.name || equipmentSelect.value);

  if (![...equipmentSelect.options].some((option) => option.value === equipment)) {
    equipmentSelect.append(new Option(equipment, equipment));
  }

  equipmentSelect.value = equipment;
  node.querySelector(".exercise-sets").value = exercise.sets ?? 4;
  node.querySelector(".exercise-reps").value = exercise.reps ?? 10;
  node.querySelector(".exercise-weight").value = exercise.weight ?? 0;
  equipmentSelect.addEventListener("change", () => updateWeightField(node));
  updateWeightField(node);
  node.querySelector(".remove-exercise").addEventListener("click", () => {
    if (exerciseList.children.length > 1) {
      node.remove();
    }
  });
  exerciseList.append(node);
}

function usesWeight(equipment) {
  return !NO_WEIGHT_EQUIPMENT.has(canonicalEquipmentName(equipment));
}

function updateWeightField(card) {
  const equipment = card.querySelector(".exercise-equipment").value;
  const weightField = card.querySelector(".weight-field");
  const weightInput = card.querySelector(".exercise-weight");
  const shouldUseWeight = usesWeight(equipment);

  weightField.hidden = !shouldUseWeight;
  weightInput.disabled = !shouldUseWeight;
  weightInput.required = shouldUseWeight;

  if (!shouldUseWeight) {
    weightInput.value = 0;
  }
}

function resetForm() {
  form.reset();
  editingSessionId = "";
  formTitle.textContent = "New Workout";
  saveWorkoutButton.textContent = "Save Workout";
  dateInput.value = todayISO();
  copySourceDateInput.value = getDefaultCopySourceDate(dateInput.value);
  exerciseList.replaceChildren();
  addExercise();
}

function readExercises() {
  return [...exerciseList.querySelectorAll(".exercise-card")].map((card) => {
    const equipment = canonicalEquipmentName(card.querySelector(".exercise-equipment").value);

    return withTrainingParts({
      name: equipment,
      sets: Number(card.querySelector(".exercise-sets").value),
      reps: Number(card.querySelector(".exercise-reps").value),
      weight: usesWeight(equipment) ? Number(card.querySelector(".exercise-weight").value) : 0,
      equipment,
      muscles: ""
    });
  }).filter((exercise) => exercise.equipment);
}

function sessionTotals(session) {
  return session.exercises.reduce((totals, exercise) => {
    totals.sets += exercise.sets;
    return totals;
  }, { sets: 0 });
}

function monthlySessions() {
  const selectedMonth = progressMonthInput.value || currentMonth();

  return sessions.filter((session) => toISODate(session.date).startsWith(selectedMonth));
}

function renderStats() {
  const today = todayISO();
  const todayEquipment = new Set();
  let todaySets = 0;

  sessions
    .filter((session) => toISODate(session.date) === today)
    .forEach((session) => {
      session.exercises.forEach((exercise) => {
        todayEquipment.add((exercise.equipment || exercise.name).toLowerCase());
        todaySets += Number(exercise.sets) || 0;
      });
    });

  statWorkouts.textContent = todayEquipment.size;
  statSets.textContent = todaySets;
}

function renderDailyTable() {
  const today = todayISO();
  const equipmentMap = new Map();

  todayDateLabel.textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${today}T00:00:00`));

  sessions
    .filter((session) => toISODate(session.date) === today)
    .forEach((session) => {
      session.exercises.forEach((exercise) => {
        const equipment = exercise.equipment || exercise.name;
        const key = equipment.toLowerCase();
        const current = equipmentMap.get(key) || {
          equipment,
          sets: 0,
          reps: exercise.reps,
          weight: exercise.weight
        };

        current.sets += Number(exercise.sets) || 0;
        current.reps = exercise.reps;
        current.weight = exercise.weight;
        equipmentMap.set(key, current);
      });
    });

  dailyTableBody.replaceChildren();
  dailyTableEmpty.hidden = equipmentMap.size > 0;
  dailyTableWrap.hidden = equipmentMap.size === 0;

  [...equipmentMap.values()]
    .sort((a, b) => a.equipment.localeCompare(b.equipment))
    .forEach((item) => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <th scope="row">${escapeHTML(item.equipment)}</th>
        <td>${item.sets}</td>
        <td>${item.reps}</td>
        <td>${formatWeight(item.equipment, item.weight)}</td>
      `;
      dailyTableBody.append(row);
    });
}

function renderHistory() {
  historyContainer.replaceChildren();
  emptyState.hidden = sessions.length > 0;

  sessions
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((session) => {
      const totals = sessionTotals(session);
      const card = document.createElement("article");
      card.className = "history-card";
      card.dataset.sessionId = session.id;

      const exercises = session.exercises.map((exercise) => {
        const equipment = exercise.equipment && exercise.equipment !== exercise.name
          ? ` (${escapeHTML(exercise.equipment)})`
          : "";
        const muscles = exercise.muscles
          ? `<small>Training: ${escapeHTML(exercise.muscles)}</small>`
          : "";

        return `<li><span>${escapeHTML(exercise.name)}${equipment}: ${formatExerciseDetails(exercise)}</span>${muscles}</li>`;
      }).join("");

      card.innerHTML = `
        <div class="history-topline">
          <div>
            <h3>${formatDate(session.date)}</h3>
            <p>${totals.sets} sets</p>
          </div>
          <div class="history-actions">
            <span class="badge">${escapeHTML(session.focus)}</span>
            <button class="text-action-button" type="button" data-edit-session="${escapeHTML(session.id)}">Edit</button>
            <button class="text-danger-button" type="button" data-delete-session="${escapeHTML(session.id)}">Delete</button>
          </div>
        </div>
        <ul>${exercises}</ul>
        ${session.notes ? `<p class="session-note">${escapeHTML(session.notes)}</p>` : ""}
      `;
      card.querySelector("[data-edit-session]").addEventListener("click", (event) => {
        event.stopPropagation();
        loadSessionForEdit(session.id);
      });
      card.querySelector("[data-delete-session]").addEventListener("click", (event) => {
        event.stopPropagation();
        deleteSession(session.id);
      });

      historyContainer.append(card);
    });
}

function copyWorkoutToForm() {
  const destinationDate = dateInput.value || todayISO();
  const sourceDate = toISODate(copySourceDateInput.value);

  if (!sourceDate) {
    importStatus.textContent = "Choose a saved workout date to copy.";
    return;
  }

  const session = sessions.find((item) => toISODate(item.date) === sourceDate);

  if (!session) {
    importStatus.textContent = `No saved workout found for ${formatDate(sourceDate)}.`;
    return;
  }

  editingSessionId = "";
  formTitle.textContent = "New Workout";
  saveWorkoutButton.textContent = "Save Workout";
  dateInput.value = destinationDate;
  exerciseList.replaceChildren();
  session.exercises.forEach((exercise) => addExercise({ ...exercise }));
  importStatus.textContent = `Copied ${formatDate(sourceDate)} into the ${formatDate(destinationDate)} form. Review and save when ready.`;
}

function getDefaultCopySourceDate(destinationDate) {
  return sessions
    .map((session) => toISODate(session.date))
    .filter((date) => date && date !== destinationDate)
    .sort((a, b) => b.localeCompare(a))[0] || "";
}

function getWeekRange(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return { start, end };
}

function dateToISO(date) {
  return localDateISO(date);
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function renderThisWeekChart(days) {
  if (!days.some((day) => day.sets > 0)) {
    return `
      <div class="weekly-chart-empty">
        <strong>No sets logged this week</strong>
        <span>Your weekly trend will appear after your first workout.</span>
      </div>
    `;
  }

  const width = 640;
  const height = 190;
  const padding = 20;
  const maxSets = Math.max(...days.map((day) => day.sets), 1);
  const xStep = (width - padding * 2) / Math.max(days.length - 1, 1);
  const points = days.map((day, index) => ({
    ...day,
    x: padding + index * xStep,
    y: height - padding - (day.sets / maxSets) * (height - padding * 2)
  }));
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${path} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;

  return `
    <div class="weekly-trend">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="This week sets trend">
        <path class="weekly-trend-area" d="${areaPath}" />
        <path class="weekly-trend-line" d="${path}" />
        ${points.map((point, index) => `
          <circle class="${index === points.length - 1 ? "is-latest" : ""}" cx="${point.x}" cy="${point.y}" r="5" />
        `).join("")}
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" />
        ${points.map((point) => `<text x="${point.x}" y="${height - 2}" text-anchor="middle">${escapeHTML(point.weekday.slice(0, 1))}</text>`).join("")}
      </svg>
    </div>
  `;
}

function renderMonthActivityGrid() {
  const month = progressMonthInput.value || currentMonth();
  const [year, monthIndex] = month.split("-").map(Number);
  const firstDay = new Date(year, monthIndex - 1, 1);
  const lastDay = new Date(year, monthIndex, 0);
  const daysInMonth = lastDay.getDate();
  const gymDays = new Set(sessions
    .map((session) => toISODate(session.date))
    .filter((date) => date.startsWith(month)));
  const blanks = Array.from({ length: firstDay.getDay() }, () => `<span class="activity-cell is-empty"></span>`).join("");
  const cells = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const iso = `${month}-${String(day).padStart(2, "0")}`;
    const isDone = gymDays.has(iso);

    return `<span class="activity-cell${isDone ? " is-done" : ""}">${isDone ? "✓" : day}</span>`;
  }).join("");

  return `
    <div class="activity-calendar">
      <div class="activity-weekdays">
        <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
      </div>
      <div class="activity-grid">${blanks}${cells}</div>
    </div>
  `;
}

function renderWeeklyProgress() {
  const { start, end } = getWeekRange();
  const startISO = dateToISO(start);
  const endISO = dateToISO(end);
  const weekSessions = sessions.filter((session) => {
    const date = toISODate(session.date);

    return date >= startISO && date <= endISO;
  });
  const gymDays = new Set(weekSessions.map((session) => toISODate(session.date)));
  const equipment = new Set();
  const equipmentByDay = new Map();
  const setsByEquipment = new Map();
  const setsByDay = new Map();

  weekSessions.forEach((session) => {
    const date = toISODate(session.date);

    session.exercises.forEach((exercise) => {
      const equipmentName = exercise.equipment || exercise.name;
      const equipmentKey = equipmentName.toLowerCase();
      equipment.add(equipmentKey);

      if (!equipmentByDay.has(date)) {
        equipmentByDay.set(date, new Set());
      }

      equipmentByDay.get(date).add(equipmentName);
      setsByDay.set(date, (setsByDay.get(date) || 0) + (Number(exercise.sets) || 0));
      const current = setsByEquipment.get(equipmentKey) || {
        name: equipmentName,
        sets: 0,
        days: new Set()
      };

      current.sets += Number(exercise.sets) || 0;
      current.days.add(date);
      setsByEquipment.set(equipmentKey, current);
    });
  });

  const dayCards = [];

  for (let index = 0; index < 7; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    const iso = dateToISO(date);
    const names = [...(equipmentByDay.get(iso) || [])].sort((a, b) => a.localeCompare(b));
    dayCards.push({
      iso,
      weekday: date.toLocaleDateString(undefined, { weekday: "short" }),
      label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      names,
      sets: setsByDay.get(iso) || 0
    });
  }

  const equipmentRows = [...setsByEquipment.values()]
    .sort((a, b) => b.sets - a.sets || a.name.localeCompare(b.name));
  const totalSets = equipmentRows.reduce((total, row) => total + row.sets, 0);
  const weekLabel = `${start.toLocaleDateString(undefined, { month: "numeric", day: "numeric" })} - ${end.toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}`;
  const daysLabel = dayCards
    .filter((day) => day.names.length)
    .map((day) => day.weekday)
    .join(", ") || "No gym days yet";

  weeklyProgress.innerHTML = `
    <article class="weekly-option weekly-feature">
      <h3>This week</h3>
      <div class="weekly-metrics">
        <div>
          <span>Gym Days</span>
          <strong>${gymDays.size}</strong>
        </div>
        <div>
          <span>Equipment</span>
          <strong>${equipment.size}</strong>
        </div>
        <div>
          <span>Sets</span>
          <strong>${totalSets}</strong>
        </div>
      </div>
      <p class="weekly-days-line">Days: ${escapeHTML(daysLabel)}</p>
      <div>
        <p class="weekly-subtitle">This week</p>
        ${renderThisWeekChart(dayCards)}
      </div>
    </article>

    <article class="weekly-option">
      <h3>Weekly Table</h3>
      <p class="weekly-days-line">Week: ${escapeHTML(weekLabel)}</p>
      <div class="weekly-table-wrap">
        <table class="weekly-table">
          <thead>
            <tr>
              <th scope="col">Equipment</th>
              <th scope="col">Sets</th>
              <th scope="col">Days</th>
            </tr>
          </thead>
          <tbody>
            ${equipmentRows.length ? equipmentRows.map((row) => `
              <tr>
                <th scope="row">${escapeHTML(row.name)}</th>
                <td>${row.sets}</td>
                <td>${row.days.size}</td>
              </tr>
            `).join("") : `
              <tr>
                <td colspan="3">No workouts logged this week.</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function renderMonthlyProgress() {
  const monthSessions = monthlySessions();
  const gymDays = new Set(monthSessions.map((session) => toISODate(session.date)));
  const equipmentProgress = new Map();

  monthSessions.forEach((session) => {
    session.exercises.forEach((exercise) => {
      const equipmentName = exercise.equipment || exercise.name || "Unlisted equipment";
      const key = equipmentName.toLowerCase();
      const current = equipmentProgress.get(key) || {
        name: equipmentName,
        exercises: new Set(),
        days: new Set(),
        muscles: exercise.muscles,
        bestWeight: 0,
        latestDate: "",
        latestWeight: 0
      };
      const sessionDate = toISODate(session.date);

      current.bestWeight = Math.max(current.bestWeight, exercise.weight);
      current.exercises.add(exercise.name);
      current.days.add(sessionDate);
      if (!current.latestDate || sessionDate >= current.latestDate) {
        current.latestDate = sessionDate;
        current.latestWeight = exercise.weight;
      }
      current.muscles = current.muscles || exercise.muscles;
      equipmentProgress.set(key, current);
    });
  });

  monthWorkouts.textContent = gymDays.size;
  progressEmpty.hidden = monthSessions.length > 0;
  renderEquipmentGraph(monthSessions, equipmentProgress);
  exerciseProgress.replaceChildren();

  const rows = [...equipmentProgress.values()]
    .sort((a, b) => b.days.size - a.days.size || b.bestWeight - a.bestWeight)
    .map((equipment) => `
      <tr>
        <th scope="row">${escapeHTML(equipment.name)}</th>
        <td>${formatWeightNumber(equipment.name, equipment.latestWeight)}</td>
        <td>${formatWeightNumber(equipment.name, equipment.bestWeight)}</td>
        <td>${equipment.days.size}</td>
        <td>${equipment.muscles ? escapeHTML(equipment.muscles) : "Not categorized"}</td>
      </tr>
    `).join("");
  const monthLabel = new Date(`${progressMonthInput.value || currentMonth()}-01T00:00:00`)
    .toLocaleDateString(undefined, { month: "long", year: "numeric" });

  exerciseProgress.innerHTML = `
    <section class="monthly-calendar-card">
      <div class="monthly-calendar-header">
        <h3>${escapeHTML(monthLabel)}</h3>
        <span>${gymDays.size} gym day${gymDays.size === 1 ? "" : "s"}</span>
      </div>
      ${renderMonthActivityGrid()}
    </section>
    ${rows ? `
      <div class="progress-table-wrap">
        <table class="progress-table">
          <thead>
            <tr>
              <th scope="col">Equipment</th>
              <th scope="col">Latest (lb)</th>
              <th scope="col">Best (lb)</th>
              <th scope="col">Days</th>
              <th scope="col">Training Parts</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    ` : ""}
  `;
}

function renderEquipmentGraph(monthSessions, equipmentProgress) {
  const equipmentNames = [...equipmentProgress.values()]
    .map((equipment) => equipment.name)
    .sort((a, b) => a.localeCompare(b));

  if (!equipmentNames.length) {
    equipmentGraph.replaceChildren();
    return;
  }

  const previousSelection = equipmentGraph.querySelector("#graph-equipment")?.value;
  const selectedEquipment = equipmentNames.includes(previousSelection)
    ? previousSelection
    : equipmentNames[0];
  const points = monthSessions
    .flatMap((session) => session.exercises.map((exercise) => ({
      date: toISODate(session.date),
      equipment: exercise.equipment || exercise.name,
      weight: exercise.weight
    })))
    .filter((entry) => entry.equipment === selectedEquipment)
    .filter((entry) => usesWeight(entry.equipment))
    .sort((a, b) => a.date.localeCompare(b.date));
  const latestByDate = new Map();

  points.forEach((point) => {
    latestByDate.set(point.date, point.weight);
  });

  const chartPoints = [...latestByDate.entries()].map(([date, weight]) => ({ date, weight }));
  equipmentGraph.innerHTML = `
    <div class="graph-header">
      <div>
        <h3>Progress Graph</h3>
        <p>Weight trend by equipment</p>
      </div>
      <label>
        Equipment
        <select id="graph-equipment">
          ${equipmentNames.map((equipment) => `<option value="${escapeHTML(equipment)}"${equipment === selectedEquipment ? " selected" : ""}>${escapeHTML(equipment)}</option>`).join("")}
        </select>
      </label>
    </div>
    ${renderWeightChart(chartPoints, selectedEquipment)}
  `;
  equipmentGraph.querySelector("#graph-equipment").addEventListener("change", renderMonthlyProgress);
}

function renderWeightChart(points, equipment) {
  if (!points.length) {
    return `<div class="chart-empty">No weight data yet.</div>`;
  }

  const width = 640;
  const height = 260;
  const padding = 42;
  const tickSize = 5;
  const chartMax = equipment === "Hammer Strength Iso-Lateral Leg Press" ? 100 : 60;
  const ticks = Array.from({ length: Math.round(chartMax / tickSize) + 1 }, (_, index) => index * tickSize);
  const xStep = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
  const coordinates = points.map((point, index) => {
    const x = points.length > 1 ? padding + index * xStep : width / 2;
    const y = height - padding - (point.weight / chartMax) * (height - padding * 2);

    return { ...point, x, y };
  });
  const path = coordinates.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return `
    <div class="chart-wrap">
      <svg class="weight-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Equipment weight progress graph">
        ${ticks.map((tick) => {
          const y = height - padding - (tick / chartMax) * (height - padding * 2);

          return `
            <line class="chart-grid-line" x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" />
            <text class="chart-axis-label" x="${padding - 8}" y="${y + 4}" text-anchor="end">${tick}</text>
          `;
        }).join("")}
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" />
        <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" />
        <path d="${path}" />
        ${coordinates.map((point) => `
          <g>
            <circle cx="${point.x}" cy="${point.y}" r="5" />
            <text x="${point.x}" y="${point.y - 12}" text-anchor="middle">${point.weight} lb</text>
            <text x="${point.x}" y="${height - 14}" text-anchor="middle">${point.date.slice(5)}</text>
          </g>
        `).join("")}
      </svg>
    </div>
  `;
}

function formatWeight(equipment, weight) {
  return usesWeight(equipment) ? `${Number(weight) || 0} lb` : "";
}

function formatWeightNumber(equipment, weight) {
  return usesWeight(equipment) ? `${Number(weight) || 0}` : "";
}

function formatExerciseDetails(exercise) {
  const parts = [`${exercise.sets} sets x ${exercise.reps} reps`];

  if (usesWeight(exercise.equipment || exercise.name)) {
    parts.push(`${Number(exercise.weight) || 0} lb`);
  }

  return parts.join(" · ");
}

function loadSessionForEdit(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);

  if (!session) {
    importStatus.textContent = "Could not find that workout to edit.";
    return;
  }

  editingSessionId = session.id;
  setActiveTab("today");
  window.location.hash = "#today";
  formTitle.textContent = `Edit ${formatDate(session.date)}`;
  saveWorkoutButton.textContent = "Update Workout";
  dateInput.value = toISODate(session.date) || todayISO();
  exerciseList.replaceChildren();
  session.exercises.forEach((exercise) => addExercise(exercise));
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  importStatus.textContent = `Editing ${formatDate(session.date)}.`;
}

function deleteSession(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);
  const label = session ? formatDate(session.date) : "this workout";

  if (!confirm(`Delete ${label}?`)) {
    return;
  }

  sessions = sessions.filter((item) => item.id !== sessionId);
  saveSessions();
  render();
  importStatus.textContent = `Deleted ${label}.`;
}

function escapeHTML(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function render() {
  renderStats();
  renderDailyTable();
  renderWeeklyProgress();
  renderMonthlyProgress();
  renderHistory();
}

function setActiveTab(tabName) {
  tabTargets.forEach((target) => {
    target.setAttribute("aria-current", target.dataset.tabTarget === tabName ? "page" : "false");
  });

  tabPanels.forEach((panel) => {
    panel.hidden = panel.dataset.tabPanel === "progress"
      ? tabName !== "progress"
      : tabName === "progress";
  });

  if (formPanel) {
    formPanel.hidden = tabName === "diary";
  }

  if (diaryPanel) {
    diaryPanel.hidden = tabName !== "diary";
  }

  if (headerBand) {
    headerBand.hidden = tabName === "progress" || tabName === "diary";
  }
}

function equipmentLookupText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalEquipmentName(value) {
  const cleanValue = cleanEquipmentName(value);
  const tracked = trackedEquipmentName(cleanValue);

  return tracked || cleanValue;
}

function trackedEquipmentName(value) {
  const cleanValue = cleanEquipmentName(value);
  const lookup = equipmentLookupText(cleanValue);

  if (!lookup) {
    return "";
  }

  const exact = TRACKED_EQUIPMENT.find((equipment) => equipmentLookupText(equipment) === lookup);

  if (exact) {
    return exact;
  }

  const alias = EQUIPMENT_ALIASES.find((item) => lookup.includes(item.match));

  if (alias) {
    return alias.equipment;
  }

  const included = TRACKED_EQUIPMENT
    .slice()
    .sort((a, b) => b.length - a.length)
    .find((equipment) => lookup.includes(equipmentLookupText(equipment)));

  return included || "";
}

function inferTrainingParts(value) {
  const text = String(value || "").toLowerCase();
  const rules = [
    { match: ["incline press", "chest press"], muscles: "Upper chest, shoulders, triceps" },
    { match: ["high row"], muscles: "Upper back, lats, rear shoulders, biceps" },
    { match: ["low row", "seated cable row", " mts row", "mts row"], muscles: "Mid-back, lats, rhomboids, biceps" },
    { match: ["lat pulldown", "pulldown"], muscles: "Lats, upper back, biceps" },
    { match: ["seated calf", "calf"], muscles: "Calves" },
    { match: ["back extension"], muscles: "Lower back, glutes, hamstrings, core" },
    { match: ["captain", "vertical knee raise", "knee raise"], muscles: "Abs, hip flexors, core" },
    { match: ["side plank"], muscles: "Obliques, core, shoulders" },
    { match: ["plank"], muscles: "Core, abs, shoulders" },
    { match: ["seated leg curl"], muscles: "Hamstrings" },
    { match: ["kneeling leg curl", "leg curl"], muscles: "Hamstrings, glutes" },
    { match: ["hip abduction"], muscles: "Glutes, outer thighs, hip abductors" },
    { match: ["hip adduction"], muscles: "Inner thighs, hip adductors" },
    { match: ["leg extension"], muscles: "Quadriceps" },
    { match: ["leg press"], muscles: "Quadriceps, glutes, hamstrings" }
  ];
  const rule = rules.find((item) => item.match.some((pattern) => text.includes(pattern)));

  return rule?.muscles || "";
}

function withTrainingParts(exercise) {
  const equipment = canonicalEquipmentName(exercise.equipment || exercise.name);
  const label = `${exercise.name || ""} ${equipment}`;

  return {
    ...exercise,
    equipment,
    muscles: exercise.muscles || inferTrainingParts(label)
  };
}

function normalizeSession(rawSession) {
  const exercises = Array.isArray(rawSession.exercises) ? rawSession.exercises : [];

  return {
    id: rawSession.id || crypto.randomUUID(),
    date: toISODate(rawSession.date) || todayISO(),
    focus: rawSession.focus || "Strength",
    notes: rawSession.notes || "",
    exercises: exercises.map((exercise) => withTrainingParts({
      name: String(exercise.name || exercise.exercise || "").trim(),
      sets: Number(exercise.sets) || 1,
      reps: Number(exercise.reps) || 1,
      weight: Number(exercise.weight) || 0,
      equipment: String(exercise.equipment || "").trim(),
      muscles: String(exercise.muscles || exercise.training_parts || exercise.main_muscles_trained || "").trim()
    })).filter((exercise) => exercise.name)
  };
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      row.push(value.trim());
      if (row.some(Boolean)) {
        rows.push(row);
      }
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  row.push(value.trim());
  if (row.some(Boolean)) {
    rows.push(row);
  }

  return rows;
}

function sessionsFromCSV(text) {
  const [headerRow, ...dataRows] = parseCSV(text);

  if (!headerRow) {
    return [];
  }

  const headers = headerRow.map((header) => header.toLowerCase().replace(/\s+/g, "_"));

  if (!headers.some((header) => ["exercise", "name", "exercise_name"].includes(header))) {
    return [];
  }

  const groups = new Map();

  dataRows.forEach((row) => {
    const entry = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
    const date = toISODate(entry.date) || todayISO();
    const focus = entry.focus || "Strength";
    const notes = entry.notes || "";
    const key = entry.workout_id || `${date}|${focus}|${notes}`;
    const exerciseName = entry.exercise || entry.name || entry.exercise_name;

    if (!exerciseName) {
      return;
    }

    if (!groups.has(key)) {
      groups.set(key, {
        id: crypto.randomUUID(),
        date,
        focus,
        notes,
        exercises: []
      });
    }

    groups.get(key).exercises.push(withTrainingParts({
      name: exerciseName,
      sets: Number(entry.sets) || 1,
      reps: Number(entry.reps) || 1,
      weight: Number(entry.weight || entry.weigh) || 0,
      equipment: entry.equipment || entry.equipment_used || entry.gear || "",
      muscles: entry.muscles || entry.training_parts || entry.main_muscles_trained || ""
    }));
  });

  return [...groups.values()];
}

function parseMarkdownTable(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"))
    .map((line) => line.slice(1, -1).split("|").map((cell) => cell.trim()))
    .filter((cells) => !cells.every((cell) => /^:?-{2,}:?$/.test(cell)));
}

function normalizedHeader(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function parseWeight(value) {
  return /bodyweight/i.test(value) ? 0 : Number(String(value).match(/\d+(?:\.\d+)?/)?.[0]) || 0;
}

function parseWorkoutWeight(value) {
  const text = String(value);

  if (/bodyweight/i.test(text)) {
    return 0;
  }

  return Number(
    text.match(/(?<weight>\d+(?:\.\d+)?)\s*lbs?\b/i)?.groups?.weight
      || text.match(/(?:@|at|weight)\s*(?<weight>\d+(?:\.\d+)?)/i)?.groups?.weight
  ) || 0;
}

function parseRepSetValue(value) {
  const text = String(value);
  const repSetMatch = text.match(/(?<reps>\d+)\s*reps?\s*\/\s*(?<sets>\d+)\s*sets?/i);
  const match = text.match(/(?<first>\d+)\s*(?:x|×|by)\s*(?<second>\d+)/i);

  if (repSetMatch?.groups) {
    return {
      reps: Number(repSetMatch.groups.reps) || 1,
      sets: Number(repSetMatch.groups.sets) || 1
    };
  }

  if (!match?.groups) {
    return {
      reps: 1,
      sets: 1
    };
  }

  return {
    reps: Number(match.groups.first) || 1,
    sets: Number(match.groups.second) || 1
  };
}

function sessionsFromMarkdownTable(text) {
  const [headerRow, ...dataRows] = parseMarkdownTable(text);

  if (!headerRow || !dataRows.length) {
    return [];
  }

  const headers = headerRow.map(normalizedHeader);
  const groups = new Map();

  dataRows.forEach((row) => {
    const entry = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
    const date = toISODate(entry.date) || todayISO();
    const name = entry.exercise || entry.name || entry.equipment || entry.equipment_used;
    const parsedRepSets = parseRepSetValue(entry.reps_sets || entry.reps_x_sets || entry.sets_reps || "");

    if (!name) {
      return;
    }

    if (!groups.has(date)) {
      groups.set(date, {
        id: crypto.randomUUID(),
        date,
        focus: "Strength",
        notes: "",
        exercises: []
      });
    }

    groups.get(date).exercises.push(withTrainingParts({
      name,
      sets: Number(entry.sets) || parsedRepSets.sets,
      reps: Number(entry.reps) || parsedRepSets.reps,
      weight: parseWeight(entry.weight || entry.weigh),
      equipment: entry.equipment_used || entry.equipment || entry.gear || (/bodyweight/i.test(entry.weight || "") ? "Bodyweight" : detectEquipment(name).equipment),
      muscles: entry.main_muscles_trained || entry.muscles || entry.training_parts || ""
    }));
  });

  return [...groups.values()].filter((session) => session.exercises.length);
}

function cleanEquipmentName(value) {
  return String(value)
    .replace(/[.。]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTrailingWeight(value) {
  return cleanEquipmentName(value)
    .replace(/\s*,?\s*\d+(?:\.\d+)?\s*lbs?\s*,?$/i, "")
    .trim();
}

function parseWorkoutNoteDetail(line, equipmentName, defaultWeight = 0) {
  const datedLine = extractDateFromLine(line);

  if (!datedLine.date) {
    return null;
  }

  const repsSets = parseRepSetValue(datedLine.line);
  const hasRepSet = /\d+\s*reps?\s*\/\s*\d+\s*sets?/i.test(datedLine.line)
    || /\d+\s*(?:x|×|by)\s*\d+/i.test(datedLine.line);

  if (!hasRepSet) {
    return null;
  }

  return {
    date: datedLine.date,
    exercise: withTrainingParts({
      name: equipmentName,
      sets: repsSets.sets,
      reps: repsSets.reps,
      weight: parseWorkoutWeight(datedLine.line) || defaultWeight,
      equipment: equipmentName,
      muscles: ""
    })
  };
}

function sessionsFromWorkoutNotes(text) {
  const groups = new Map();
  let currentEquipment = "";
  let currentDefaultWeight = 0;
  let lastWorkoutDate = "";

  function addExercise(date, exercise) {
    if (!groups.has(date)) {
      groups.set(date, {
        id: crypto.randomUUID(),
        date,
        focus: "Strength",
        notes: "",
        exercises: []
      });
    }

    groups.get(date).exercises.push(exercise);
  }

  text.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line || /^workou?t$/i.test(line) || /^workuot$/i.test(line)) {
      return;
    }

    const dateMatch = line.match(/\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/);
    const repSetLike = /\d+\s*reps?\s*\/\s*\d+\s*sets?/i.test(line) || /\d+\s*(?:x|×|by)\s*\d+/i.test(line);

    if (dateMatch && repSetLike) {
      const headingBeforeDate = stripTrailingWeight(line.slice(0, dateMatch.index).replace(/[-,]+$/g, ""));
      const equipmentName = headingBeforeDate || currentEquipment;
      const defaultWeight = parseWeight(line.slice(0, dateMatch.index)) || currentDefaultWeight;
      const parsed = parseWorkoutNoteDetail(line.slice(dateMatch.index), equipmentName, defaultWeight);

      if (parsed?.exercise?.name) {
        currentEquipment = equipmentName;
        currentDefaultWeight = defaultWeight;
        addExercise(parsed.date, parsed.exercise);
        lastWorkoutDate = parsed.date;
      }
      return;
    }

    if (currentEquipment && repSetLike) {
      const parsed = parseWorkoutNoteDetail(`${lastWorkoutDate || todayISO()} - ${line}`, currentEquipment, currentDefaultWeight);

      if (parsed) {
        addExercise(parsed.date, parsed.exercise);
        lastWorkoutDate = parsed.date;
      }
      return;
    }

    currentEquipment = stripTrailingWeight(line);
    currentDefaultWeight = parseWeight(line);
  });

  return [...groups.values()].filter((session) => session.exercises.length);
}

function extractDateFromLine(line) {
  const dateMatch = line.match(/\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/);

  if (!dateMatch) {
    return {
      date: "",
      line
    };
  }

  return {
    date: toISODate(dateMatch[0]),
    line: line.replace(dateMatch[0], " ").replace(/\s+/g, " ").trim()
  };
}

function detectEquipment(value) {
  const tracked = trackedEquipmentName(value);

  if (tracked) {
    return {
      equipment: tracked,
      name: tracked
    };
  }

  const lowerValue = value.toLowerCase();
  const keyword = EQUIPMENT_KEYWORDS.find((item) => lowerValue.includes(item));

  if (!keyword) {
    return {
      equipment: "",
      name: value.trim()
    };
  }

  const equipment = keyword
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
    .replace("Ez", "EZ");

  return {
    equipment,
    name: value
      .replace(new RegExp(`\\b${keyword}\\b`, "i"), " ")
      .replace(/\s+/g, " ")
      .trim()
  };
}

function parsePlainExercise(line) {
  const datedLine = extractDateFromLine(line);
  const normalized = datedLine.line
    .replace(/\blbs?\b/gi, "")
    .replace(/\bpounds?\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const cleaned = normalized.replace(/\breps?\b/gi, "").replace(/\s+/g, " ").trim();
  const match = cleaned.match(/^(?<name>.*?)[,\s]+(?<sets>\d+)\s*(?:x|by|sets?\s*(?:of)?)[\s,]*(?<reps>\d+)(?:\s*(?:@|at|,)?\s*(?<weight>\d+(?:\.\d+)?))?$/i)
    || cleaned.match(/^(?<name>.*?)[,\s]+(?<sets>\d+)[,\s]+(?<reps>\d+)(?:[,\s]+(?<weight>\d+(?:\.\d+)?))?$/i);

  if (!match?.groups?.name) {
    return parseLabeledPlainExercise(normalized, datedLine.date);
  }

  const equipmentResult = detectEquipment(match.groups.name.replace(/[-:@,\s]+$/g, "").trim());

  return withTrainingParts({
    name: equipmentResult.name,
    sets: Number(match.groups.sets) || 1,
    reps: Number(match.groups.reps) || 1,
    weight: Number(match.groups.weight) || 0,
    equipment: equipmentResult.equipment,
    muscles: "",
    date: datedLine.date
  });
}

function parseLabeledPlainExercise(line, date = "") {
  const setsMatch = line.match(/\b(?<sets>\d+)\s*sets?\b/i);
  const repsMatch = line.match(/\b(?<reps>\d+)\s*reps?\b/i) || line.match(/\bsets?\s*(?:of)?\s*(?<reps>\d+)\b/i);
  const weightMatch = line.match(/(?:@|at|weight|weighted?)\s*(?<weight>\d+(?:\.\d+)?)/i);

  if (!setsMatch?.groups?.sets || !repsMatch?.groups?.reps) {
    return null;
  }

  const equipmentResult = detectEquipment(line
    .slice(0, setsMatch.index)
    .replace(/[-:@,\s]+$/g, "")
    .trim());

  if (!equipmentResult.name) {
    return null;
  }

  return withTrainingParts({
    name: equipmentResult.name,
    sets: Number(setsMatch.groups.sets) || 1,
    reps: Number(repsMatch.groups.reps) || 1,
    weight: Number(weightMatch?.groups?.weight) || 0,
    equipment: equipmentResult.equipment,
    muscles: "",
    date
  });
}

function sessionsFromPlainText(text) {
  const session = {
    id: crypto.randomUUID(),
    date: todayISO(),
    focus: "Strength",
    notes: "",
    exercises: [],
    skippedLines: []
  };

  text.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      return;
    }

    const [label, ...rest] = line.split(":");
    const normalizedLabel = label.toLowerCase();

    if (rest.length && ["date", "focus", "notes"].includes(normalizedLabel)) {
      session[normalizedLabel] = normalizedLabel === "date"
        ? toISODate(rest.join(":")) || todayISO()
        : rest.join(":").trim();
      return;
    }

    const exercise = parsePlainExercise(line);

    if (exercise) {
      if (exercise.date) {
        session.date = exercise.date;
        delete exercise.date;
      }
      session.exercises.push(exercise);
    } else {
      session.skippedLines.push(line);
    }
  });

  return session.exercises.length ? [session] : [];
}

function sessionsFromUpload(fileName, text) {
  if (fileName.toLowerCase().endsWith(".csv")) {
    return sessionsFromCSV(text);
  }

  const parsed = JSON.parse(text);
  const rawSessions = Array.isArray(parsed) ? parsed : parsed.sessions;

  if (!Array.isArray(rawSessions)) {
    throw new Error("JSON must be an array or an object with a sessions array.");
  }

  return rawSessions.map(normalizeSession).filter((session) => session.exercises.length);
}

function sessionsFromPastedText(text) {
  const tableSessions = sessionsFromMarkdownTable(text);

  if (tableSessions.length) {
    return {
      format: "Markdown table",
      sessions: tableSessions
    };
  }

  const csvSessions = sessionsFromCSV(text);

  if (csvSessions.length) {
    return {
      format: "CSV",
      sessions: csvSessions
    };
  }

  const workoutNoteSessions = sessionsFromWorkoutNotes(text);

  if (workoutNoteSessions.length) {
    return {
      format: "workout notes",
      sessions: workoutNoteSessions
    };
  }

  return {
    format: "plain text",
    sessions: sessionsFromPlainText(text)
  };
}

function mergeSessionByDate(nextSession) {
  const date = toISODate(nextSession.date) || todayISO();
  const existingSession = sessions.find((session) => toISODate(session.date) === date);

  if (!existingSession) {
    sessions.push({
      ...nextSession,
      date
    });
    return "created";
  }

  existingSession.exercises = [...existingSession.exercises, ...nextSession.exercises];
  existingSession.focus = existingSession.focus || nextSession.focus || "Strength";
  existingSession.notes = [existingSession.notes, nextSession.notes].filter(Boolean).join(" ");
  return "merged";
}

function mergeSessionsByDate(nextSessions) {
  let created = 0;
  let merged = 0;

  nextSessions.forEach((session) => {
    const result = mergeSessionByDate(session);

    if (result === "created") {
      created += 1;
    } else {
      merged += 1;
    }
  });

  return {
    created,
    merged
  };
}

function saveImportedSessions(importedSessions, source) {
  if (!importedSessions.length) {
    importStatus.textContent = `No valid workouts found in ${source}.`;
    return false;
  }

  mergeSessionsByDate(importedSessions);
  saveSessions();
  render();
  importStatus.textContent = `Imported ${importedSessions.length} workout${importedSessions.length === 1 ? "" : "s"}.`;
  return true;
}

function importPastedSessions() {
  const text = pasteDataInput.value.trim();

  if (!text) {
    importStatus.textContent = "Paste workout data first.";
    pasteDataInput.focus();
    return;
  }

  try {
    const result = sessionsFromPastedText(text);

    if (saveImportedSessions(result.sessions, "the pasted data")) {
      const exerciseCount = result.sessions.reduce((count, session) => count + session.exercises.length, 0);
      importStatus.textContent = `Imported ${result.sessions.length} workout${result.sessions.length === 1 ? "" : "s"} from ${result.format} with ${exerciseCount} exercise${exerciseCount === 1 ? "" : "s"}.`;
      pasteDataInput.value = "";
    } else if (result.format === "plain text") {
      importStatus.textContent = "I could not read those lines yet. Try: Deadlift 3x5 @ 225 or Squat 3 sets of 8 reps at 185.";
    }
  } catch (error) {
    importStatus.textContent = error.message || "Could not import the pasted data.";
  }
}

function exportSessions() {
  const blob = new Blob([JSON.stringify({ sessions }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `workout-data-${todayISO()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

addExerciseButton.addEventListener("click", () => addExercise());
copyWorkoutButton.addEventListener("click", copyWorkoutToForm);
tabTargets.forEach((target) => {
  target.addEventListener("click", (event) => {
    event.preventDefault();
    setActiveTab(target.dataset.tabTarget);
    window.location.hash = target.getAttribute("href");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});
progressMonthInput.addEventListener("change", renderMonthlyProgress);
clearFormButton.addEventListener("click", () => {
  resetForm();
  importStatus.textContent = "Workout form cleared.";
});
clearHistoryButton.addEventListener("click", () => {
  if (!sessions.length || !confirm("Delete all saved workouts?")) {
    return;
  }

  sessions = [];
  saveSessions();
  render();
});
historyContainer.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-session]");

  if (editButton) {
    loadSessionForEdit(editButton.dataset.editSession);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-session]");

  if (!deleteButton) {
    return;
  }

  const sessionId = deleteButton.dataset.deleteSession;
  deleteSession(sessionId);
});
exportHistoryButton.addEventListener("click", exportSessions);
importPasteButton.addEventListener("click", importPastedSessions);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const exercises = readExercises();

  if (!exercises.length) {
    exerciseList.querySelector(".exercise-equipment")?.focus();
    return;
  }

  const nextSession = {
    id: editingSessionId || crypto.randomUUID(),
    date: dateInput.value,
    focus: "Strength",
    notes: "",
    exercises
  };

  if (editingSessionId) {
    sessions = sessions.map((session) => session.id === editingSessionId ? nextSession : session);
    importStatus.textContent = `Updated ${formatDate(nextSession.date)}.`;
  } else {
    mergeSessionByDate(nextSession);
  }

  saveSessions();
  resetForm();
  render();
  importStatus.textContent = `Saved ${exercises.length} equipment entr${exercises.length === 1 ? "y" : "ies"} for ${formatDate(nextSession.date)}.`;
});

progressMonthInput.value = currentMonth();
resetForm();
render();
setActiveTab(window.location.hash === "#progress" ? "progress" : window.location.hash === "#diary" ? "diary" : "today");

if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).then((registration) => {
    registration.update();
  });
}
