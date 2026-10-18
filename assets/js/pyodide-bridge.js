window.pyodideInstance = null;
window.pythonModules = {};

const moduleFiles = [
    'oop_concepts.py',
    'stack.py',
    'queue.py',
    'matrix_grid.py',
    'hierarchical_tree_and_traversals.py',
    'bst.py',
    'hash.py',
    'graph.py',
    'sorting.py',
    'searching.py',
    'paradigms.py',
    'dyna_memo_dc.py'
];

async function initPyodideEngine() {
    const consoleEl = document.getElementById("output-console");
    try {
        console.log("⌛ Starting Pyodide WASM Engine...");
        window.pyodideInstance = await loadPyodide();
        
        for (const file of moduleFiles) {
            const filePath = `./python/modules/${file}`;
            try {
                const response = await fetch(filePath);
                if (!response.ok) {
                    console.error(`❌ HTTP ${response.status} - File not found: ${filePath}`);
                    continue;
                }
                const text = await response.text();
                window.pythonModules[file] = text;
                
                // Execute code inside Pyodide WASM
                await window.pyodideInstance.runPythonAsync(text);
                console.log(`✅ Loaded Python module: ${file}`);
            } catch (fileErr) {
                console.error(`❌ Python Syntax/Runtime Error inside '${file}':`, fileErr);
            }
        }

        // Verify if SoilMatrixGrid is defined before instantiation
        const isMatrixDefined = window.pyodideInstance.runPython(`'SoilMatrixGrid' in globals()`);
        if (!isMatrixDefined) {
            throw new Error("SoilMatrixGrid is missing from Python globals! Check matrix_grid.py for Python syntax errors.");
        }

        // Initialize runtime instances after all classes are defined
        await window.pyodideInstance.runPythonAsync(`
        grid = SoilMatrixGrid(5, 5)
        stack = ActionStack()
        environment_queue = EnvironmentQueue()
        quest_tree = QuestProgressionTree()
        inventory_hash = InventoryHashTable()

        # Pre-load Starter Kit into player inventory hash table:
        inventory_hash.add("Parsnip Seed", {
            "type": "seed", 
            "count": 3, 
            "key": "Parsnip Seed",
            "crop_key": "parsnip"
        })`
        );

        if (consoleEl) {
            consoleEl.textContent = "✅ Pyodide WASM Engine initialized!\nReady for actions. Purchase seeds in the Frog Shop!";
        }
        
        if (window.syncPythonToUI) window.syncPythonToUI();
        if (window.updateCodeViewer) window.updateCodeViewer();

    } catch (err) {
        console.error("Pyodide Initialization Failed:", err);
        if (consoleEl) consoleEl.textContent = `❌ Pyodide Engine Failed to load: ${err.message}`;
    }
}

window.runPython = function(code) {
    if (!window.pyodideInstance) return null;
    try {
        return window.pyodideInstance.runPython(code);
    } catch (e) {
        console.error("Python Execution Error:", e);
        return null;
    }
};

document.addEventListener("DOMContentLoaded", initPyodideEngine);