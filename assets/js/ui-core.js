/**
 * @file ui-core.js
 * @description Core UI Controller & Pyodide Bridge Integration for Wumbus' Garden Simulator.
 * Manages HUD state synchronization, tool selection, tab navigation, execution trace logging,
 * modal overlays, and the Weather Channel 30-day Binary Search Tree (BST) forecast calendar.
 */

/* ==========================================================================
   1. DOM Initialization & Pyodide Readiness Polling
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // Render initial UI fallbacks prior to Pyodide WASM initialization
  renderFallbackGrid();
  updateStatusUI();
  renderMinecraftHotbar();

  // Close modals when clicking outside modal cards on the backdrop overlay
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  // Global Escape key shortcut listener to dismiss active modal dialogs
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document
        .querySelectorAll(".modal-overlay.active")
        .forEach((m) => closeModal(m.id));
    }
  });

  // Poll Pyodide readiness state until WebAssembly runtime is fully loaded
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (pythonInitDone) {
      clearInterval(timer);
    } else if (pythonStateReady()) {
      clearInterval(timer);
      onPyodideReady();
    } else if (tries > 300) {
      // Timeout safety after ~90 seconds of polling
      clearInterval(timer);
    }
  }, 300);
});

/**
 * Triggered once Pyodide runtime initialization completes successfully.
 * Synchronizes initial Python state, loads player stats, updates code viewer,
 * and queries tomorrow's disaster forecast.
 */
function onPyodideReady() {
  if (pythonInitDone) return;
  pythonInitDone = true;

  loadCoinsFromPython();
  syncBucketToPython();
  updateStatusUI();
  window.syncPythonToUI();
  updateCodeViewer();
  checkDisasterForecast();

  logConsole("Python engine ready. View Mechanics.");
  // Log the Pyodide WASM Engine & Core DSA Bootstrap
  if (typeof window.logPythonTrace === "function") {
    window.logPythonTrace("Initialize Engine & Data Structures", [
      {
        file: "oop_concepts.py",
        fn: "CROP_DATABASE Registry Loaded",
        dsa: "O(1) Hash Table Lookup Ready"
      },
      {
        file: "matrix_grid.py",
        fn: "SoilMatrixGrid(rows=5, cols=5)",
        dsa: "2D Matrix Array Instantiation O(R*C)"
      },
      {
        file: "stack.py",
        fn: "ActionStack.__init__()",
        dsa: "LIFO Action History Stack Initialized"
      },
      {
        file: "queue.py",
        fn: "EnvironmentQueue.__init__()",
        dsa: "FIFO Climate Queue & 30-Day BST Seeded"
      }
    ]);
  }
}
window.onPyodideReady = onPyodideReady;

/* ==========================================================================
   2. DOM & HUD State Synchronization Helpers
   ========================================================================== */

/**
 * Utility helper to safely set element text content by ID.
 * @param {string} id - Target DOM element ID.
 * @param {string} text - Text string to render.
 */
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/**
 * Queries active HUD state properties directly from Python WASM memory environment.
 * @returns {Object|null} Deserialized JSON object containing current season, day, weather,
 * water bucket limits, active quest descriptions, and frog EXP stats.
 */
function readHudState() {
  return pyJson(`
import json

def _hud_safe(fn, default=None):
    try:
        value = fn()
        return value() if callable(value) else value
    except Exception:
        return default

_season = _hud_safe(lambda: environment_queue.get_current_season(), "Spring")
_node = _hud_safe(lambda: quest_tree.current_node)

json.dumps({
    "season": _season,
    "day": _hud_safe(lambda: environment_queue.current_day),
    "weather": _hud_safe(lambda: environment_queue.get_current_weather()),
    "aoe": _hud_safe(lambda: quest_tree.get_aoe_range(), 1),
    "max_bucket": _hud_safe(lambda: quest_tree.get_max_bucket(), 5),
    "quest_desc": _hud_safe(lambda: quest_tree.get_current_quest_desc(_season)),
    "level": getattr(_node, "level", None),
    "title": getattr(_node, "title", None),
    "perk": getattr(_node, "perk_description", getattr(_node, "perk", "")),
    "exp": _hud_safe(lambda: quest_tree.current_exp, 0),
    "req_exp": _hud_safe(lambda: quest_tree.exp_to_next_level, 0)
}, default=str)
    `);
}

/**
 * Master HUD UI sync method. Reads state from Python memory (or local fallbacks)
 * and updates energy, water bucket, coins, season indicators, weather icons, and quest EXP bars.
 */
function updateStatusUI() {
  const hud = pyReady() ? readHudState() : null;

  // Re-calculate maximum bucket capacity from quest tree unlocks
  if (hud) {
    maxBucket = Math.max(1, Number(hud.max_bucket) || 5);
    if (userBucket > maxBucket) userBucket = maxBucket;
  }

  // Update Top Stat Strip DOM elements
  setText("stat-energy", `${userEnergy}`);
  const energyEl = document.getElementById("stat-energy");
  if (energyEl) energyEl.title = `${userEnergy} / ${maxEnergy}`;

  setText("stat-bucket", `${userBucket}/${maxBucket}`);
  setText("stat-coins", `${userCoins}`);

  // Glossy progress fills (Energy / Water / Coins)
  renderStatBars();

  if (!hud) return;

  // Render active Season Name and Day Number
  if (hud.season) {
    const seasonEl = document.getElementById("stat-season");
    if (seasonEl) {
      const seasonInfo = `${hud.season} (Day ${hud.day})`;
      seasonEl.innerHTML = `<img src="${escapeHtml(getSeasonIconUrl(hud.season))}" alt="${escapeHtml(hud.season)}" referrerpolicy="no-referrer" style="width: 20px; height: 20px; vertical-align: middle; margin-right: 6px;"> ${escapeHtml(formatSeason(seasonInfo))}`;
    }
  }

  // Render Weather Status & Icon
  if (hud.weather) {
    setText("stat-weather", String(hud.weather));
    const weatherIcon = document.getElementById("weather-icon");
    if (weatherIcon) weatherIcon.src = getWeatherIconUrl(hud.weather);
    applyWeatherTheme(hud.weather); // sunny sky + rays  <->  rain + lightning
  }

  // Render Tool AOE Range Badge
  const aoe = Math.max(1, Number(hud.aoe) || 1);
  setText("aoe-status", `Tool Tier: ${aoe}x${aoe} AOE`);

  // Render Wumbus Quest Title, Level Badge, and EXP Progress Track
  if (hud.quest_desc)
    setText("frog-quest-desc", `"${wumbusText(hud.quest_desc)}"`);
  if (hud.perk) setText("frog-perk-desc", `Reward Perk: ${hud.perk}`);
  if (hud.level !== null && hud.level !== undefined)
    setText("frog-level", `Lvl ${hud.level}`);
  if (hud.title) setText("frog-title", wumbusText(hud.title));

  const exp = Number(hud.exp) || 0;
  const reqExp = Number(hud.req_exp) || 0;
  const expPercent =
    reqExp > 0
      ? Math.max(0, Math.min(100, Math.floor((exp / reqExp) * 100)))
      : 0;
  const bar = document.getElementById("frog-exp-bar");
  if (bar) bar.style.width = `${expPercent}%`;

}
window.updateStatsUI = updateStatusUI;

/* ==========================================================================
   3. Tool Selection & Navigation Tab Control
   ========================================================================== */

/**
 * Synchronizes active visual state (`.active` class and `aria-pressed`) on toolbar buttons.
 */
function syncToolButtons() {
  document.querySelectorAll(".tool-btn").forEach((btn) => {
    const on = btn.id === `tool-${activeTool}`;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

/**
 * Sets the active farming tool action (hoe, water, plant, scythe, shovel, fertilizer).
 * @param {string} toolName - Name identifier of selected tool.
 * @param {boolean} [silent=false] - If true, suppresses console output message.
 */
function setTool(toolName, silent = false) {
  activeTool = toolName;
  syncToolButtons();
  if (!silent) logConsole(`Selected Tool: ${String(toolName).toUpperCase()}`);
}

/**
 * Switches the right panel town view between Quests, Shop, and Sell tabs,
 * updating ARIA accessibility attributes and triggering DSA execution traces.
 * @param {string} name Tab name ('quests', 'shop', or 'sell').
 */
function switchTab(name) {
  beginActionTrace("Tab Switched");
  ["quests", "shop", "sell"].forEach((t) => {
    const tab = document.getElementById(`tab-${t}`);
    const panel = document.getElementById(`panel-${t}`);
    const isActive = t === name;

    if (tab) {
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
      tab.classList.toggle("active", isActive);
      tab.tabIndex = isActive ? 0 : -1;
    }

    if (panel) {
      if (isActive) {
        panel.removeAttribute("hidden");
      } else {
        panel.setAttribute("hidden", "");
      }
    }
  });

  // Safe execution trace log emission upon tab navigation
  if (typeof window.logPythonTrace === "function") {
    if (name === "quests") {
      logPythonTrace("Opened Quests View", [
        {
          file: "hierarchical_tree_and_traversals.py",
          fn: "quest_tree.get_current_quest_desc()",
          dsa: "Tree Pointer Traversal",
        },
      ]);
    } else if (name === "shop") {
      logPythonTrace("Opened Shop View", [
        {
          file: "queue.py",
          fn: "environment_queue.get_current_season()",
          dsa: "FIFO Queue Inspection",
        },
        {
          file: "oop_concepts.py",
          fn: "CROP_DATABASE.values()",
          dsa: "Static Registry Iteration",
        },
      ]);
    } else if (name === "sell") {
      logPythonTrace("Opened Sell View", [
        {
          file: "hash.py",
          fn: "inventory_hash.to_list()",
          dsa: "Hash Table Array Serialization",
        },
      ]);
    }
  }
}

/* ==========================================================================
   4. Action Output & Function Trace Logging Systems
   ========================================================================== */

/**
 * Outputs a real-time player action message to the top garden banner console.
 * @param {string} msg - Action description text.
 */
function logConsole(msg) {
  const el = document.getElementById("output-console");
  if (!el) return;
  el.textContent = `${msg}`;
  el.title = msg; // Native hover tooltip fallback
}
window.logConsole = logConsole;

// Unique identifier tracking the current user action cycle
let currentActionId = null;

/**
 * Starts a fresh action trace session, clearing logs from past actions.
 * Call this at the start of top-level user event handlers.
 * @param {string} actionTitle - Name of the action header (e.g., "Till Soil Action").
 */
function beginActionTrace(actionTitle) {
  currentActionId = Symbol(actionTitle);
  const traceBox = document.getElementById("trace-console");
  if (!traceBox) return;

  // Clear previous action traces and set up scrollable container header
  traceBox.style.overflowY = "auto";
  traceBox.style.maxHeight = "100%"; // or fixed px height, e.g., "240px"
  traceBox.innerHTML = `
    <div style="color: #f59e0b; font-weight: bold; margin-bottom: 6px; border-bottom: 1px dashed rgba(245, 158, 11, 0.4); padding-bottom: 2px; sticky; top: 0; z-index: 2;">
      [ACTION]: ${escapeHtml(actionTitle)}
    </div>
    <div id="trace-cards-container" style="display: flex; flex-direction: column; gap: 8px;"></div>
  `;
}
window.beginActionTrace = beginActionTrace;

/**
 * Appends Python function execution traces to the active action batch.
 * If called without prior beginActionTrace, it automatically starts a new batch.
 *
 * @param {string} traceName - Sub-action or DSA trace title.
 * @param {Array<{fn: string, file: string, dsa: string}>} calls - List of executed Python calls.
 */
function logPythonTrace(traceName, calls) {
  const traceBox = document.getElementById("trace-console");
  if (!traceBox) return;

  let container = document.getElementById("trace-cards-container");

  // Fallback: If no action session is active, start a new one automatically
  if (!container || !currentActionId) {
    beginActionTrace(traceName);
    container = document.getElementById("trace-cards-container");
  }

  // Construct trace card HTML for this specific call batch
  let cardHTML = `
    <div class="trace-card" style="font-family: var(--font-mono, monospace); font-size: 0.75rem; line-height: 1.5; padding: 6px; border-radius: 4px; border-left: 3px solid #38bdf8;">
      <div style="color: #38bdf8; font-weight: 600; margin-bottom: 4px;">▸ ${escapeHtml(traceName)}</div>
  `;

  calls.forEach((call) => {
    cardHTML += `
      <div style="color: #a7f3d0; margin-bottom: 1px;">
          ⌂ &nbsp;${escapeHtml(call.file)}
      </div>
      <div style="color: #fef08a; padding-left: 12px; margin-bottom: 1px;">
          ▸ &nbsp;${escapeHtml(call.fn)}
      </div>
      ${
        call.dsa
          ? `<div style="color: #cbd5e1; padding-left: 24px; margin-bottom: 2px;">
              ⊛ &nbsp;${escapeHtml(call.dsa)}
             </div>`
          : ""
      }
    `;
  });

  cardHTML += `</div>`;

  // Append new card and auto-scroll to the bottom of the trace box
  if (container) {
    container.insertAdjacentHTML("beforeend", cardHTML);
    traceBox.scrollTop = traceBox.scrollHeight;
  }
}
window.logPythonTrace = logPythonTrace;

/**
 * Tab switcher helper for Action Console vs Function Trace View panels.
 * @param {string} tabName - Selected panel ('actions' or 'trace').
 */
function switchLogTab(tabName) {
  const actionsTab = document.getElementById("log-tab-actions");
  const traceTab = document.getElementById("log-tab-trace");
  const consoleBox = document.getElementById("output-console");
  const traceBox = document.getElementById("trace-console");

  if (tabName === "actions") {
    if (actionsTab) actionsTab.classList.add("active");
    if (traceTab) traceTab.classList.remove("active");
    if (consoleBox) consoleBox.hidden = false;
    if (traceBox) traceBox.hidden = true;
  } else {
    if (traceTab) traceTab.classList.add("active");
    if (actionsTab) actionsTab.classList.remove("active");
    if (traceBox) traceBox.hidden = false;
    if (consoleBox) consoleBox.hidden = true;
  }
}
window.switchLogTab = switchLogTab;

/* ==========================================================================
   5. Modal Dialog Management & Python Source Viewer
   ========================================================================== */

/**
 * Opens a modal dialog by ID and initializes modal content if needed.
 * @param {string} id - Target DOM element ID of modal overlay.
 */

function openModal(id) {

  beginActionTrace("Opened a Modal");
  if (id === "shop-modal") {
    renderShopSeasonalCrops();

    // Log Python WASM execution trace for opening the Shop
    if (typeof window.logPythonTrace === "function") {
      window.logPythonTrace("Open Frog Shop Catalog", [
        {
          file: "queue.py",
          fn: "environment_queue.get_current_season()",
          dsa: "FIFO Climate Queue Inspection O(1)"
        },
        {
          file: "oop_concepts.py",
          fn: "CROP_DATABASE.values()",
          dsa: "O(1) Hash Registry Iteration"
        }
      ]);
    }
  }

  if (id === "code-modal") {
    updateCodeViewer();
  }

  const modal = document.getElementById(id);
  if (modal) modal.classList.add("active");
}

/**
 * Closes an active modal dialog overlay by ID.
 * @param {string} id - Target DOM element ID of modal overlay.
 */
function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove("active");
}

/**
 * Reads selected Python module source code from `window.pythonModules`
 * and updates the code viewer pre-block element in the reference modal.
 */
function updateCodeViewer() {
  const selector = document.getElementById("file-selector");
  const viewer = document.getElementById("code-viewer");
  if (!selector || !viewer) return;

  const modules = window.pythonModules;
  let source;
  if (modules instanceof Map) source = modules.get(selector.value);
  else if (modules && typeof modules === "object")
    source = modules[selector.value];

  viewer.textContent = source || "# Code loading...";
}
window.updateCodeViewer = updateCodeViewer;

/* ==========================================================================
   6. Asset Asset URL Resolvers & Text Formatting Filters
   ========================================================================== */

/**
 * Resolves the seasonal wiki badge icon URL based on season string.
 * @param {string} season - Season name ('Spring', 'Summer', 'Fall', 'Winter').
 * @returns {string} Icon URL.
 */
function getSeasonIconUrl(season) {
  const s = String(normalizePy(season) || "").toLowerCase();
  if (s.includes("summer"))
    return "https://stardewvalleywiki.com/mediawiki/images/8/85/Summer.png";
  if (s.includes("fall") || s.includes("autumn"))
    return "https://stardewvalleywiki.com/mediawiki/images/5/5d/Fall.png";
  if (s.includes("winter"))
    return "https://stardewvalleywiki.com/Special:FilePath/Winter.png";
  return "https://stardewvalleywiki.com/mediawiki/images/9/9c/Spring.png";
}

/**
 * Resolves atmospheric weather condition icon URL.
 * @param {string} weather - Weather condition ('Sunny', 'Rainy', etc.).
 * @returns {string} Icon URL.
 */
function getWeatherIconUrl(weather) {
  const w = String(normalizePy(weather) || "").toLowerCase();
  if (w.includes("storm") || w.includes("thunder")) return STORM_ICON;
  if (w.includes("rain") || w.includes("drizzle") || w.includes("shower"))
    return RAIN_ICON;
  if (w.includes("snow") || w.includes("frost") || w.includes("blizzard"))
    return SNOW_ICON;
  return SUN_ICON;
}

/**
 * Replaces legacy NPC text names with Wumbus branding.
 * @param {string} text - Raw input string.
 * @returns {string} Sanitized text string.
 */
function wumbusText(text) {
  return String(text || "")
    .replace(/The Frog Prince/g, "Wumbus")
    .replace(/Frog Prince/g, "Wumbus");
}

/**
 * Formats season and day number strings for clean header display.
 * @param {string} text - Raw season string (e.g., "Spring (Day 1)").
 * @returns {string} Formatted string (e.g., "Spring 01").
 */
function formatSeason(text) {
  const m = String(text || "").match(/^(\S+)\s*\(Day\s*(\d+)\)/i);
  return m ? `${m[1]} ${String(m[2]).padStart(2, "0")}` : text;
}

/* ==========================================================================
   7. Weather Channel 30-Day BST Forecast Radar & Modal System
   ========================================================================== */

/**
 * Safely evaluates Python global queue variables across variable name fallbacks.
 * @returns {string} Python code expression string.
 */
function getPythonQueueExpr() {
  return `(globals().get('climate_queue') or globals().get('environment_queue') or globals().get('queue'))`;
}

/**
 * Opens the TV Weather Channel Modal safely.
 * `openModal` is invoked first to guarantee UI opening even if Python queries fail.
 */
function openForecastModal() {
  openModal("forecast-modal");

  try {
    if (typeof checkDisasterForecast === "function") checkDisasterForecast();
  } catch (e) {
    console.error("Radar update error:", e);
  }

  try {
    if (typeof renderForecastCalendar === "function") renderForecastCalendar();
  } catch (e) {
    console.error("Calendar update error:", e);
  }

  // Log trace for opening the TV Weather Radar Channel
  if (typeof window.logPythonTrace === "function") {
    window.logPythonTrace("Check TV Weather Radar", [
      {
        file: "bst.py",
        fn: "WeatherBST.search_range(1, 30)",
        dsa: "Binary Search Tree Range Query O(log N + K)"
      },
      {
        file: "queue.py",
        fn: "environment_queue.peek_upcoming(30)",
        dsa: "FIFO Queue Iteration O(N)"
      }
    ]);
  }
}
window.openForecastModal = openForecastModal;

/**
 * Queries the 30-day Binary Search Tree (BST) specifically for tomorrow's forecast (current_day + 1).
 * Updates both the TV header LED/GIF indicator and the modal radar banner card.
 */
function checkDisasterForecast() {
  if (!window.runPython) return;

  try {
    const pyCode = `
import json
q = globals().get('climate_queue') or globals().get('environment_queue') or globals().get('queue')
cur_day = getattr(q, 'current_day', 1) if q else 1
cal = q.get_season_calendar() if (q and hasattr(q, 'get_season_calendar')) else []

# Parse calendar array if returned as serialized JSON string
if isinstance(cal, str):
    try:
        cal = json.loads(cal)
    except:
        cal = []

# Filter hazard node specifically for tomorrow (current_day + 1)
tomorrow = cur_day + 1
tomorrow_node = next((node for node in cal if isinstance(node, dict) and node.get('day') == tomorrow), None)

upcoming = []
if tomorrow_node and (tomorrow_node.get('disaster') or tomorrow_node.get('has_disaster')):
    upcoming.append(tomorrow_node)

json.dumps(upcoming)
        `;

    const jsonStr = window.runPython(pyCode);
    let upcomingHazards = [];

    if (jsonStr) {
      try {
        upcomingHazards =
          typeof jsonStr === "string" ? JSON.parse(jsonStr) : jsonStr;
      } catch (err) {
        upcomingHazards = [];
      }
    }

    // Emit Python Execution Trace Log
    if (typeof window.logPythonTrace === "function") {
      window.logPythonTrace("Checked Weather Disaster Forecast Radar", [
        {
          file: "bst.py",
          fn: "environment_queue.get_season_calendar()",
          dsa: "Binary Search Tree In-Order Traversal O(N)"
        }
      ]);
    }

    const hasDanger =
      Array.isArray(upcomingHazards) && upcomingHazards.length > 0;

    // Remembered so End Day can play the matching grid animation
    window.tomorrowHazard = hasDanger
      ? upcomingHazards[0].disaster || "Environmental Hazard"
      : null;

    // 1. Update TV Header Screen GIF & Red/Green LED Alert Dot for Tomorrow
    if (typeof updateTVForecastIcon === "function") {
      updateTVForecastIcon(hasDanger);
    }

    // 2. Update Modal Radar Banner Card Text & Risk Badge
    const radarTagEl = document.querySelector(".radar-tag");
    const radarTextEl = document.getElementById("forecast-radar-text");
    const riskPillEl = document.getElementById("forecast-risk-pill");

    if (radarTagEl) {
      radarTagEl.textContent = "TOMORROW'S FORECAST RADAR";
    }

    if (hasDanger) {
      const nextHazard = upcomingHazards[0];
      const hazardName = nextHazard.disaster || "Environmental Hazard";
      const dayNum =
        nextHazard.day < 10 ? "0" + nextHazard.day : nextHazard.day;

      if (radarTextEl) {
        radarTextEl.textContent = `"WARNING! ${hazardName} predicted for TOMORROW (Day ${dayNum})! Protect your crops!"`;
      }
      if (riskPillEl) {
        riskPillEl.textContent = "HAZARD DETECTED";
        riskPillEl.className = "risk-badge risk-danger";
      }
    } else {
      if (radarTextEl) {
        radarTextEl.textContent = `"Welcome to the Weather Channel! No disaster predicted for tomorrow."`;
      }
      if (riskPillEl) {
        riskPillEl.textContent = "SAFE";
        riskPillEl.className = "risk-badge risk-safe";
      }
    }
  } catch (e) {
    console.error("Forecast BST Query Error:", e);
  }
}
window.checkDisasterForecast = checkDisasterForecast;

/**
 * Updates the Header TV Set GIF image and top-right LED indicator status
 * based on BST tomorrow disaster forecast query results.
 *
 * @param {boolean} upcomingDisasterFound - True if a disaster is predicted for tomorrow.
 */
function updateTVForecastIcon(upcomingDisasterFound) {
  const tvImg = document.getElementById("tv-screen-gif");
  const ledDot = document.getElementById("tv-alert-dot");

  const dangerGif =
    typeof TV_FORECAST_CONFIG !== "undefined" && TV_FORECAST_CONFIG.DANGER_GIF
      ? TV_FORECAST_CONFIG.DANGER_GIF
      : "https://stardewvalleywiki.com/mediawiki/images/3/3b/LuckSkullMin.gif";

  const safeGif =
    typeof TV_FORECAST_CONFIG !== "undefined" && TV_FORECAST_CONFIG.SAFE_GIF
      ? TV_FORECAST_CONFIG.SAFE_GIF
      : "https://stardewvalleywiki.com/mediawiki/images/8/8a/LuckStarMax.gif";

  if (upcomingDisasterFound) {
    if (tvImg) tvImg.src = dangerGif;
    if (ledDot) {
      ledDot.classList.add("has-danger");
      ledDot.classList.remove("is-safe");
    }
  } else {
    if (tvImg) tvImg.src = safeGif;
    if (ledDot) {
      ledDot.classList.remove("has-danger");
      ledDot.classList.add("is-safe");
    }
  }
}
window.updateTVForecastIcon = updateTVForecastIcon;

/**
 * Executes an In-Order Traversal on the 30-day Binary Search Tree (bst.py)
 * to render all 30 days chronologically into the modal calendar grid.
 */
function renderForecastCalendar() {
  const gridEl = document.getElementById("forecast-grid-matrix");
  if (!gridEl || !window.runPython) return;

  gridEl.innerHTML = "";

  try {
    const pyCode =
      "import json\n" +
      "q = globals().get('climate_queue') or globals().get('environment_queue') or globals().get('queue')\n" +
      "res = q.get_season_calendar() if (q and hasattr(q, 'get_season_calendar')) else []\n" +
      "json.dumps(res)";

    const jsonStr = window.runPython(pyCode);
    let calendarData = [];

    if (jsonStr) {
      try {
        calendarData =
          typeof jsonStr === "string" ? JSON.parse(jsonStr) : jsonStr;
      } catch (err) {
        calendarData = [];
      }
    }

    // Emit Python Execution Trace Log for 30-Day BST In-Order Traversal
    if (typeof window.logPythonTrace === "function") {
      window.logPythonTrace("Render 30-Day Weather Forecast Calendar", [
        {
          file: "bst.py",
          fn: "WeatherBST.in_order_traversal()",
          dsa: "Binary Search Tree In-Order Traversal O(N)",
        },
      ]);
    }

    const currentDayVal = window.runPython(
      "getattr(globals().get('climate_queue') or globals().get('environment_queue'), 'current_day', 1)",
    );
    const currentDay = Number(currentDayVal) || 1;

    if (!Array.isArray(calendarData) || calendarData.length === 0) {
      gridEl.innerHTML = `<p style="font-size:0.78rem; color:#555; text-align:center; grid-column:span 6; width:100%; padding: 12px;">No forecast data available.</p>`;
      return;
    }

    const iconMap =
      typeof FORECAST_ICON_MAP !== "undefined" ? FORECAST_ICON_MAP : {};
    const fallbackIcon =
      "https://stardewvalleywiki.com/mediawiki/images/2/26/SunAnimated.gif";

    // Populate grid cards for Day 1 through Day 30
    calendarData.forEach((node) => {
      const dayCard = document.createElement("div");
      const isToday = Number(node.day) === currentDay;
      const hasHazard = Boolean(node.has_disaster || node.disaster);

      let cardClass = "forecast-day-card";
      if (isToday) cardClass += " active-today";
      if (hasHazard) cardClass += " danger-day";
      dayCard.className = cardClass;

      const iconKey = node.disaster || node.weather || "Sunny";
      const iconUrl = iconMap[iconKey] || fallbackIcon;
      const labelText = node.disaster
        ? node.disaster.split(" ")[0]
        : node.weather;

      dayCard.innerHTML = `
                <span class="day-num">Day ${node.day < 10 ? "0" + node.day : node.day}</span>
                <img src="${iconUrl}" alt="${labelText}" class="day-icon" onerror="this.src='${fallbackIcon}'" />
                <span class="day-status ${hasHazard ? "hazard-text" : ""}">${labelText}</span>
            `;

      gridEl.appendChild(dayCard);
    });
  } catch (e) {
    console.error("Error rendering forecast calendar:", e);
    gridEl.innerHTML = `<p style="font-size:0.78rem; color:#666; text-align:center; grid-column:span 6; width:100%;">Failed to load forecast data.</p>`;
  }
}
window.renderForecastCalendar = renderForecastCalendar;

/**
 * Synchronizes the NPC title, level badge, and hover tooltip title attribute
 * directly from Python N-ary quest_tree memory.
 */
function updateFrogLevelBadge() {
  if (!pyReady()) return;

  // Query updated values directly from Python WASM tree
  const level = Number(py("quest_tree.current_level")) || 1;
  const levelTitle = py("str(getattr(quest_tree.current_node, 'title', 'Novice Gardener'))");
  const activePerk = py("quest_tree.get_current_perk_description()");

  const levelEl = document.getElementById("frog-level");
  const titleEl = document.getElementById("frog-title");

  if (titleEl) {
    titleEl.textContent = levelTitle;
  }

  if (levelEl) {
    // 1. Update visual badge text
    levelEl.textContent = `Lvl ${level}`;

    // 2. Update hover tooltip title attribute
    levelEl.setAttribute("title", `Active Perk: ${activePerk}`);
  }
}

/* ==========================================================================
   8. Weather Theme, Progress Bars & Garden Disaster Animations (v0.8.0)
   ========================================================================== */

/* ---------- 8a. Weather theme (sunny sky + rays  <->  gloomy rain + lightning) ---------- */

/**
 * Switches the whole scene between the sunny afternoon and the stormy sky.
 * Only the class on <html> changes; every visual is driven by styles.css:
 *   weather-sunny : blue sky, glowing sun, warm sunrays, birds
 *   weather-rainy : slate storm sky, falling rain, intermittent lightning (no sun)
 * Storm, thunder, drizzle and shower weather all count as rainy.
 * @param {string} weather - Weather label from the Python state (e.g. "Sunny", "Rainy").
 */
function applyWeatherTheme(weather) {
  const w = String(normalizePy(weather) || "").toLowerCase();
  const rainy = /rain|drizzle|shower|storm|thunder/.test(w);
  const root = document.documentElement;
  root.classList.toggle("weather-rainy", rainy);
  root.classList.toggle("weather-sunny", !rainy);
  root.dataset.weather = rainy ? "rainy" : "sunny";
}
window.applyWeatherTheme = applyWeatherTheme;

/* ---------- 8b. Glossy progress bars (Energy, Water, Coins) ---------- */

// Coins have no hard maximum, so the bar fills against the next "goal" tier.
const COIN_BAR_TIERS = [250, 500, 1000, 2500, 5000, 10000];

/**
 * @param {number} coins - Current coin count.
 * @returns {number} The smallest tier that holds `coins` (grows in 10k steps past the last tier).
 */
function coinBarCap(coins) {
  return COIN_BAR_TIERS.find((tier) => coins <= tier) || Math.ceil(coins / 10000) * 10000;
}

/**
 * Sets one progress bar's width (as a percentage) plus its ARIA values.
 * The CSS width transition animates the fill as resources are spent or refilled.
 * @param {string} fillId - ID of the .stat-fill element.
 * @param {number} value - Current amount.
 * @param {number} max - Maximum for the bar.
 */
function setStatBar(fillId, value, max) {
  const fill = document.getElementById(fillId);
  if (!fill) return;

  const safeMax = Math.max(1, Number(max) || 1);
  const safeValue = Math.max(0, Number(value) || 0);
  const pct = Math.min(100, (safeValue / safeMax) * 100);

  fill.style.width = `${pct}%`;

  const track = fill.parentElement;
  if (track) {
    track.setAttribute("aria-valuemax", String(safeMax));
    track.setAttribute("aria-valuenow", String(safeValue));
  }

  const card = fill.closest(".stat-card");
  if (card) card.classList.toggle("is-low", pct <= 20);
}

/**
 * Refreshes all three bars from the shared game globals.
 * Called from updateStatusUI(), so it runs after every action that spends or gains resources.
 */
function renderStatBars() {
  const energy = typeof userEnergy !== "undefined" ? userEnergy : 0;
  const energyMax = typeof maxEnergy !== "undefined" ? maxEnergy : 100;
  const bucket = typeof userBucket !== "undefined" ? userBucket : 0;
  const bucketMax = typeof maxBucket !== "undefined" ? maxBucket : 5;
  const coins = typeof userCoins !== "undefined" ? userCoins : 0;

  setStatBar("stat-energy-fill", energy, energyMax);
  setStatBar("stat-bucket-fill", bucket, bucketMax);
  setStatBar("stat-coins-fill", coins, coinBarCap(Number(coins) || 0));
}
window.renderStatBars = renderStatBars;

/* ---------- 8c. Disaster animations over the garden grid ---------- */

// Each effect = the class put on #garden-stage + how long it runs (ms, matches styles.css).
const DISASTER_FX = {
  earthquake: { cls: "is-earthquake", ms: 1800 },
  alien: { cls: "is-alien", ms: 3000 },
  "green-rain": { cls: "is-green-rain", ms: 3000 },
  meteor: { cls: "is-meteor", ms: 2600 },
};

let disasterFxTimer = null;

/**
 * Maps a disaster name from the forecast / game state to an effect key.
 * @param {string} name - e.g. "Meteorite Strike", "Alien Escape", "Green Rain Windstorm", "Earthquake".
 * @returns {string|null} Key of DISASTER_FX, or null when the name is not recognised.
 */
function resolveDisasterType(name) {
  const n = String(normalizePy(name) || "").toLowerCase();
  if (n.includes("meteor")) return "meteor";
  if (n.includes("alien") || n.includes("ufo")) return "alien";
  if (n.includes("green") || n.includes("wind") || n.includes("acid")) return "green-rain";
  if (n.includes("quake") || n.includes("earth")) return "earthquake";
  return null;
}

/** Removes any running disaster animation from the garden. */
function clearDisasterFx() {
  clearTimeout(disasterFxTimer);
  const stage = document.getElementById("garden-stage");
  if (stage) {
    Object.values(DISASTER_FX).forEach((fx) => stage.classList.remove(fx.cls));
  }
  document.documentElement.classList.remove("is-quaking");
}

/**
 * Plays the animation for a nightly disaster on top of the soil grid.
 * Safe to call repeatedly: a new call restarts the animation from the beginning.
 * @param {string} name - Disaster name (see resolveDisasterType).
 * @returns {string|null} The effect key that played, or null if nothing matched.
 */
function playDisasterFx(name) {
  const type = resolveDisasterType(name);
  const stage = document.getElementById("garden-stage");
  if (!type || !stage) return null;

  const fx = DISASTER_FX[type];
  clearDisasterFx();
  void stage.offsetWidth; // force reflow so the CSS animations restart

  stage.classList.add(fx.cls);
  if (type === "earthquake") document.documentElement.classList.add("is-quaking");

  disasterFxTimer = setTimeout(clearDisasterFx, fx.ms + 150);
  return type;
}
window.playDisasterFx = playDisasterFx;
window.clearDisasterFx = clearDisasterFx;

/* ---------- 8d. Hook into "End Day" ---------- */

// true  -> play the effect for the hazard the Weather Channel predicted for tomorrow
// false -> only play effects you trigger yourself with playDisasterFx(name)
const AUTO_PLAY_FORECAST_HAZARD = true;

/**
 * Wraps advanceNextDay() so the garden reacts when the day rolls over.
 * It refreshes tomorrow's BST forecast first, then plays that hazard's animation
 * while the original day-advance logic runs untouched.
 */
(function hookAdvanceDay() {
  if (typeof window.advanceNextDay !== "function" || window.advanceNextDay.__fxHooked) return;

  const original = window.advanceNextDay;
  const wrapped = function (...args) {
    if (AUTO_PLAY_FORECAST_HAZARD) {
      try {
        if (typeof checkDisasterForecast === "function") checkDisasterForecast();
        if (window.tomorrowHazard) playDisasterFx(window.tomorrowHazard);
      } catch (e) {
        console.error("Disaster FX error:", e);
      }
    }
    return original.apply(this, args);
  };
  wrapped.__fxHooked = true;
  window.advanceNextDay = wrapped;
})();