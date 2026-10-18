/**
 * @file pyodide-bridge.js
 * @description WebAssembly (WASM) Pyodide Engine Bridge & Python Module Loader.
 * Asynchronously fetches and loads Python modules into Pyodide WASM memory in strict dependency order,
 * verifies global class definitions, instantiates runtime data structure objects, and exposes
 * the global `window.runPython` execution wrapper.
 */

/* ==========================================================================
   1. Global Engine State & Module Execution Order
   ========================================================================== */

/** @type {Object|null} Global Pyodide WASM Engine runtime instance. */
window.pyodideInstance = null;

/** @type {Object<string, string>} Cache storing raw Python module source code for UI inspection. */
window.pythonModules = {};

/**
 * Sequential loading array for Python data structure and logic modules.
 * CRITICAL DEPENDENCY NOTE: `bst.py` MUST be fetched and executed BEFORE `queue.py`
 * so that `DisasterForecastBST` is defined prior to `EnvironmentQueue` initialization.
 */
const moduleFiles = [
  "oop_concepts.py",
  "stack.py",
  "bst.py",                       // 👈 Loaded before queue.py to satisfy dependency imports
  "queue.py",
  "matrix_grid.py",
  "hierarchical_tree_and_traversals.py",
  "hash.py",
  "graph.py",
  "sorting.py",
  "searching.py",
  "paradigms.py",
  "dyna_memo_dc.py",
];

/* ==========================================================================
   2. Pyodide Initialization & Data Structure Instantiation
   ========================================================================== */

/**
 * Bootstraps the Pyodide WebAssembly runtime, fetches all Python modules asynchronously,
 * verifies class definitions, and instantiates global game controller objects.
 *
 * @async
 * @returns {Promise<void>}
 */
async function initPyodideEngine() {
  const consoleEl = document.getElementById("output-console");

  try {
    console.log("⌛ Starting Pyodide WASM Engine...");
    window.pyodideInstance = await loadPyodide();

    // Sequentially fetch and evaluate Python modules in Pyodide memory
    for (const file of moduleFiles) {
      const filePath = `./python/modules/${file}`;
      try {
        const response = await fetch(filePath);
        if (!response.ok) {
          console.error(
            `❌ HTTP ${response.status} - File not found: ${filePath}`
          );
          continue;
        }
        const text = await response.text();

        // Cache raw module source code for the in-game Module Reference Viewer
        window.pythonModules[file] = text;

        // Execute script inside Pyodide WASM global environment
        await window.pyodideInstance.runPythonAsync(text);
        console.log(`✅ Loaded Python module: ${file}`);
      } catch (fileErr) {
        console.error(
          `❌ Python Syntax/Runtime Error inside '${file}':`,
          fileErr
        );
      }
    }

    // Integrity Check: Verify that core SoilMatrixGrid class exists before instantiating
    const isMatrixDefined = window.pyodideInstance.runPython(
      `'SoilMatrixGrid' in globals()`
    );
    if (!isMatrixDefined) {
      throw new Error(
        "SoilMatrixGrid is missing from Python globals! Check matrix_grid.py for Python syntax errors."
      );
    }

    // Instantiate primary game controller instances inside Python runtime memory
    await window.pyodideInstance.runPythonAsync(`
        grid = SoilMatrixGrid(5, 5)
        stack = ActionStack()
        environment_queue = EnvironmentQueue()
        climate_queue = environment_queue
        quest_tree = QuestProgressionTree()
        inventory_hash = InventoryHashTable()

        # Pre-load Starter Kit into player inventory hash table:
        inventory_hash.add("Parsnip Seed", {
            "type": "seed", 
            "count": 3, 
            "key": "Parsnip Seed",
            "crop_key": "parsnip"
        })`);

    // Log initialization status to the user interface console banner
    if (consoleEl) {
      consoleEl.textContent =
        "✅ Pyodide WASM Engine initialized!\nReady for actions. Purchase seeds in the Frog Shop!";
    }

    // Trigger UI synchronization hooks upon engine readiness
    if (window.syncPythonToUI) window.syncPythonToUI();
    if (window.updateCodeViewer) window.updateCodeViewer();
  } catch (err) {
    console.error("Pyodide Initialization Failed:", err);
    if (consoleEl) {
      consoleEl.textContent = `❌ Pyodide Engine Failed to load: ${err.message}`;
    }
  }
}

/* ==========================================================================
   3. Global Python Runner & Lifecycle Event Listeners
   ========================================================================== */

/**
 * Safely evaluates a string of Python code inside Pyodide runtime environment.
 *
 * @param {string} code - Python code statement or expression.
 * @returns {*} Evaluation result returned by Pyodide, or null if execution fails.
 */
window.runPython = function (code) {
  if (!window.pyodideInstance) return null;
  try {
    return window.pyodideInstance.runPython(code);
  } catch (e) {
    console.error("Python Execution Error:", e);
    return null;
  }
};

// Initialize Pyodide WASM engine automatically when document finishes loading
document.addEventListener("DOMContentLoaded", initPyodideEngine);