/**
 * @file pyodide-utils.js
 * @description WASM Interoperability & Utility Helpers for Pyodide Integration.
 * Provides memory proxies conversion (PyProxy destruction), safe Python code evaluation wrappers,
 * JSON bridge deserialization helpers, HTML string escaping, and global player economy state synchronization.
 */

/* ==========================================================================
   1. PyProxy Memory Conversion & Data Normalization
   ========================================================================== */

/**
 * Normalizes raw Python WebAssembly objects (PyProxy) returned by Pyodide into standard 
 * JavaScript primitives, Arrays, or Objects, automatically invoking `.destroy()` to prevent memory leaks.
 *
 * @param {*} value - Value returned by Pyodide runtime (PyProxy, Map, Primitive, Array, etc.).
 * @returns {*} Fully converted JavaScript value with freed WASM memory handles.
 */
function normalizePy(value) {
  if (value === null || value === undefined) return value;

  // Handle PyProxy objects created by Pyodide WASM runtime
  if (typeof value === "object" && typeof value.toJs === "function") {
    let converted;
    try {
      converted = value.toJs({ dict_converter: Object.fromEntries });
    } finally {
      // Free C/WASM heap memory allocated for PyProxy
      if (typeof value.destroy === "function") {
        try {
          value.destroy();
        } catch (e) {
          // Ignore destruction error if already garbage collected
        }
      }
    }
    return normalizePy(converted);
  }

  // Convert Python dictionaries marshaled as JS Maps
  if (value instanceof Map) {
    const obj = {};
    value.forEach((v, k) => {
      obj[k] = normalizePy(v);
    });
    return obj;
  }

  // Recursively normalize array elements
  if (Array.isArray(value)) return value.map(normalizePy);

  return value;
}

/* ==========================================================================
   2. Python Engine Evaluation Wrappers
   ========================================================================== */

/**
 * Checks whether the Pyodide WebAssembly runner is ready to execute code.
 * @returns {boolean} True if window.runPython function bridge is available.
 */
function pyReady() {
  return typeof window.runPython === "function";
}

/**
 * Safely executes Python code inside the Pyodide WebAssembly engine with error catching
 * and memory proxy normalization.
 *
 * @param {string} code - Python code string to evaluate.
 * @param {boolean} [silent=false] - If true, suppresses console error logs upon exception.
 * @returns {*} Converted JavaScript return value, or undefined if execution fails.
 */
function py(code, silent = false) {
  if (!pyReady()) return undefined;
  try {
    return normalizePy(window.runPython(code));
  } catch (err) {
    if (!silent) {
      console.error("[Pyodide error]", err, "\n", code);
      const lines = String(err && err.message ? err.message : err)
        .split("\n")
        .filter(Boolean);
      logConsole(`Python error: ${lines[lines.length - 1] || "unknown error"}`);
    }
    return undefined;
  }
}

/**
 * Evaluates Python code expected to return a JSON-encoded string, automatically parsing
 * it into a JavaScript Object. Bypasses Pyodide proxy conversion bottlenecks.
 *
 * @param {string} code - Python code snippet evaluating to a JSON string (e.g., `json.dumps(...)`).
 * @returns {Object|Array|null} Deserialized JavaScript object or null on parse failure.
 */
function pyJson(code) {
  const raw = py(code);
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("[pyJson] parsing error:", raw, e);
    return null;
  }
}

/**
 * Escapes JavaScript variable values for safe inline insertion into Python code strings.
 * @param {*} value - Raw input value.
 * @returns {string} JSON-stringified value suitable for embedding into Python expressions.
 */
function pyStr(value) {
  return JSON.stringify(String(value));
}

/**
 * Verifies that all core required global Python instances (grid, inventory_hash, environment_queue,
 * quest_tree, CROP_DATABASE) exist in Pyodide global memory.
 *
 * @returns {boolean} True if all core runtime objects are instantiated in Python.
 */
function pythonStateReady() {
  if (!pyReady()) return false;
  return (
    py(
      `all(n in globals() for n in ("grid", "inventory_hash", "environment_queue", "quest_tree", "CROP_DATABASE"))`,
      true,
    ) === true
  );
}

/* ==========================================================================
   3. String Formatting & Sanitization Utilities
   ========================================================================== */

/**
 * Escapes special HTML characters to prevent XSS vulnerabilities when inserting raw strings into DOM.
 * @param {*} value - Input text string.
 * @returns {string} HTML-safe sanitized string.
 */
function escapeHtml(value) {
  return String(value === null || value === undefined ? "" : value).replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
}

/**
 * Converts crop item names into URL-friendly keys (slugs).
 * Example: "Parsnip Seed" -> "parsnip".
 */
window.slugify =
  window.slugify ||
  function (text) {
    return String(normalizePy(text) || "")
      .trim()
      .toLowerCase()
      .replace(/\s+seeds?$/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

/* ==========================================================================
   4. Economy & Resource State Sync Helpers
   ========================================================================== */

/**
 * Pushes the active JavaScript `userCoins` balance into Python global scope.
 */
function syncCoinsToPython() {
  if (!pyReady()) return;
  py(`
user_coins = ${Math.floor(userCoins)}
if 'player' in globals() and hasattr(player, 'coins'):
    player.coins = user_coins
    `);
}

/**
 * Sets player coin count and syncs the updated value to Python memory.
 * @param {number} amount - Target coin amount.
 */
function setCoins(amount) {
  userCoins = Math.max(0, Math.floor(Number(amount) || 0));
  syncCoinsToPython();
}

/**
 * Adjusts player coin balance by delta offset.
 * @param {number} delta - Positive value to add coins, or negative value to spend coins.
 */
function addCoins(delta) {
  setCoins(userCoins + Number(delta || 0));
}

/**
 * Reads player coin balance from Python global memory during game initialization.
 */
function loadCoinsFromPython() {
  const pyCoins = py(
    `(player.coins if ('player' in globals() and hasattr(player, 'coins')) else (user_coins if 'user_coins' in globals() else None))`,
  );
  if (typeof pyCoins === "number") {
    userCoins = pyCoins;
  } else {
    syncCoinsToPython();
  }
}

/**
 * Synchronizes player water bucket level to the Python grid matrix instance.
 */
function syncBucketToPython() {
  if (pyReady()) py(`grid.bucket_level = ${Math.floor(userBucket)}`);
}