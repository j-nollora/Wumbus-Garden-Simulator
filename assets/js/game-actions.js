function getCropStageImgUrl(tile) {
    if (!tile) return GENERIC_CROP_ICON;

    const name = tile.name;
    const assets = CROP_ASSETS[name];

    if (assets && assets.stage_images && assets.stage_images.length > 0) {
        const stage = Number(tile.stage) || 0;
        const maxStage = Math.max(1, Number(tile.max_stage) || 1);

        let tier;
        if (stage <= 0) tier = 0;
        else if (stage >= maxStage) tier = 3;
        else if (stage >= Math.floor(maxStage / 2)) tier = 2;
        else tier = 1;

        return assets.stage_images[tier] || assets.item_icon;
    }

    return getCropImgUrl(tile.name);
}

function cropImg(name, cls = '', alt = '') {
    const src = getCropImgUrl(name);
    return `<img class="${escapeHtml(cls)}" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${GENERIC_CROP_ICON}'">`;
}

function refillWaterAtWell() {
    if (activeTool !== 'water') {
        logConsole("Equip watering can first.");
        return;
    }
    if (userBucket >= maxBucket) {
        logConsole(`Your watering can is already full (${maxBucket}L).`);
        return;
    }
    if (userEnergy < WELL_ENERGY_COST) {
        logConsole(`Refill requires ${WELL_ENERGY_COST} Energy!`);
        return;
    }
    userEnergy -= WELL_ENERGY_COST;
    userBucket = maxBucket;
    syncBucketToPython();
    logConsole(`Successfully refilled watering can(-${WELL_ENERGY_COST} Energy)`);
    updateStatusUI();

    logPythonTrace("Refilled Water Can at Well", [
        { file: "matrix_grid.py", fn: "grid.bucket_level = max_bucket", dsa: "Direct Attribute Mutation" },
        { file: "hierarchical_tree_and_traversals.py", fn: "quest_tree.get_max_bucket()", dsa: "Dynamic Level Threshold Calculation" }
    ]);
}

function handleTileClick(r, c) {
    if (!pyReady()) return;

    if (userEnergy < ENERGY_PER_ACTION) {
        logConsole("Error: out of energy! Click End Day to recover.");
        return;
    }

    const aoe = Math.max(1, Number(py(`quest_tree.get_aoe_range()`)) || 1);
    let actionExecuted = false;
    aoeAborted = false;

    outer:
    for (let dr = 0; dr < aoe; dr++) {
        for (let dc = 0; dc < aoe; dc++) {
            if (aoeAborted) break outer;
            const tr = r + dr;
            const tc = c + dc;
            if (tr < GRID_ROWS && tc < GRID_COLS) {
                if (executeToolOnTile(tr, tc)) actionExecuted = true;
            }
        }
    }

    if (actionExecuted) {
        userEnergy -= ENERGY_PER_ACTION;
        syncBucketToPython();
        updateStatusUI();
    }
    window.syncPythonToUI();
}

function executeToolOnTile(r, c) {
    if (activeTool === 'hoe') {
        const currentWeather = window.runPython(`environment_queue.get_current_weather() if 'environment_queue' in globals() else "Sunny"`);
        const ok = window.runPython(`grid.till_soil(${r}, ${c}, "${currentWeather}")`);

        if (ok) {
            logConsole(`Tilled Soil at [${r}, ${c}]${currentWeather === 'Rainy' ? ' (Auto-watered by Rain!)' : ''}`);
            
            logPythonTrace("Till Soil Action", [
                { file: "matrix_grid.py", fn: "grid.till_soil(r, c, weather)", dsa: "2D Array Indexing O(1)" },
                { file: "stack.py", fn: "stack.push(action_dict)", dsa: "LIFO Stack Action Push" }
            ]);

            if (window.syncPythonToUI) window.syncPythonToUI();
            return true;
        } else {
            // 💡 Feedback when clicking soil that's already tilled
            logConsole(`Warning: Tile [${r}, ${c}] is already tilled soil!`);
            return false;
        }
    } else if (activeTool === 'water') {
        if (userBucket <= 0) {
            logConsole("Error: Watering Can is empty (0 L)! Click the Well to refill.");
            aoeAborted = true;
            return false;
        }

        // 1. Check if the tile is actually dry & tilled in Python first
        const isWaterable = window.runPython(`
    tile = grid.get_tile(${r}, ${c})
    bool(tile and tile.is_tilled and not tile.is_watered)
        `);

        if (!isWaterable) {
            const isTilled = window.runPython(`bool(grid.get_tile(${r}, ${c}) and grid.get_tile(${r}, ${c}).is_tilled)`);
            if (!isTilled) {
                logConsole(`Warning: Tile [${r}, ${c}] is raw dirt! Till it with the Hoe first.`);
            } else {
                logConsole(`Warning: Tile [${r}, ${c}] is already watered!`);
            }
            return false;
        }

        // 2. Execute water action & push to stack
        const ok = window.runPython(`grid.water_soil(${r}, ${c})`);

        if (ok) {
            userBucket -= 1;

            // Push to stack in Python
            window.runPython(`
    if 'stack' in globals():
        stack.push({'action': 'water', 'r': ${r}, 'c': ${c}, 'desc': 'Watered Tile at [${r}, ${c}]'})
            `);

            // Log to console & header banner
            logConsole(`Watered tile [${r}, ${c}] (-1L Water)`);

            // Log to Function Trace Panel
            logPythonTrace("Water Soil Action", [
                { file: "matrix_grid.py", fn: "grid.water_soil(r, c)", dsa: "2D Matrix Tile State Mutation" },
                { file: "stack.py", fn: "stack.push(action_dict)", dsa: "LIFO Stack Action Push" }
            ]);

            if (window.syncPythonToUI) window.syncPythonToUI();
            return true;
        }
    } else if (activeTool === 'plant') {
        if (!selectedInventoryKey || !selectedInventoryKey.toLowerCase().includes('seed')) {
            logConsole("Error: select a seed from your Inventory first!");
            aoeAborted = true;
            return false;
        }
        if (getInventoryCount(selectedInventoryKey) <= 0) {
            logConsole(`Error: no ${selectedInventoryKey}s remaining!`);
            selectedInventoryKey = null;
            aoeAborted = true;
            return false;
        }

        const cropKey = selectedInventoryKey.replace(/\s+seed$/i, '').trim();

        // 1. Check if the tile is valid for planting (must be tilled brown soil with no crop)
        const canPlant = window.runPython(`
    tile = grid.get_tile(${r}, ${c})
    bool(tile and tile.is_tilled and tile.crop is None)
        `);

        if (!canPlant) {
            logConsole(`Warning: cannot plant at [${r}, ${c}]! (Tile must be tilled soil without existing crops)`);
            return false;
        }

        // 2. Execute planting in Python directly
        const planted = window.runPython(`grid.plant_seed(${r}, ${c}, CROP_DATABASE.get(${pyStr(cropKey)}))`);

        if (planted) {
            // Push action onto stack.py
            window.runPython(`
    if 'stack' in globals():
        stack.push({'action': 'plant', 'r': ${r}, 'c': ${c}, 'desc': 'Planted ${cropKey} at [${r}, ${c}]'})
            `);

            // Consume seed item from Hash Table inventory
            consumeItem(selectedInventoryKey);

            // Update Console & Trace Log
            logConsole(`Planted ${cropKey} at tile [${r}, ${c}]`);
            logPythonTrace("Planted Seed Action", [
                { file: "oop_concepts.py", fn: "CROP_DATABASE.get(cropKey)", dsa: "Dictionary Key Lookup" },
                { file: "matrix_grid.py", fn: "grid.plant_seed(r, c, crop)", dsa: "2D Matrix Tile Object Insertion" },
                { file: "stack.py", fn: "stack.push(action_dict)", dsa: "LIFO Stack Action Push" }
            ]);

            clearSelectionIfEmpty();
            if (window.syncPythonToUI) window.syncPythonToUI();
            return true;
        } else {
            logConsole(`Warning: cannot plant ${cropKey} at [${r}, ${c}]!`);
            return false;
        }
    } else if (activeTool === 'fertilizer') {
        if (!selectedInventoryKey || !selectedInventoryKey.toLowerCase().includes('fertilizer')) {
            logConsole("Error: select Fertilizer from your Inventory first! (Buy it in the Shop)");
            aoeAborted = true;
            return false;
        }
        if (getInventoryCount(selectedInventoryKey) <= 0) {
            logConsole("Error: out of Fertilizer! Buy more in the Shop.");
            selectedInventoryKey = null;
            aoeAborted = true;
            return false;
        }

        // 1. Check if the tile is valid for fertilizer (must have an active, un-wilted, un-shielded crop)
        const canFertilize = window.runPython(`
    tile = grid.get_tile(${r}, ${c})
    bool(tile and tile.crop and not tile.is_wilted and not tile.is_fertilized)
        `);

        if (!canFertilize) {
            logConsole(`Warning: cannot apply fertilizer at [${r}, ${c}]! (Requires an unshielded active crop)`);
            return false;
        }

        // 2. Execute fertilizer application directly in Python
        const applied = window.runPython(`grid.apply_fertilizer(${r}, ${c})`);

        if (applied) {
            // Push action onto stack.py
            window.runPython(`
    if 'stack' in globals():
        stack.push({'action': 'fertilize', 'r': ${r}, 'c': ${c}, 'desc': 'Fertilized Tile at [${r}, ${c}]'})
            `);

            // Consume fertilizer item from inventory
            consumeItem(selectedInventoryKey);

            // Update Console & Trace Log
            logConsole(`Applied fertilizer defense shield to tile [${r}, ${c}]!`);
            logPythonTrace("Applied Fertilizer Defense Shield", [
                { file: "matrix_grid.py", fn: "grid.apply_fertilizer(r, c)", dsa: "Tile Attribute Shield Mutation" },
                { file: "stack.py", fn: "stack.push(action_dict)", dsa: "LIFO Stack Action Push" }
            ]);

            clearSelectionIfEmpty();
            if (window.syncPythonToUI) window.syncPythonToUI();
            return true;
        } else {
            logConsole(`Warning: cannot apply fertilizer at [${r}, ${c}]!`);
            return false;
        }
    } else if (activeTool === 'scythe') {
        const result = pyJson(`
        import json
        _w = environment_queue.get_current_weather() if 'environment_queue' in globals() else "Sunny"
        _tile = grid.get_tile(${r}, ${c})
        _crop = _tile.crop if _tile else None
        _ready = bool(_crop is not None and not _tile.is_wilted and _tile.growth_stage >= _crop.days_to_grow)
        _harvested = grid.harvest_crop(${r}, ${c}, _w) if _ready else None
        json.dumps({
            "had_crop": _crop is not None,
            "wilted": bool(_tile.is_wilted) if _tile else False,
            "ready": _ready,
            "name": _harvested.name if _harvested else None
        })
        `);

        if (result && result.name) {
            const cropUrl = getCropImgUrl(result.name);

            // 1. Add harvested crop to inventory hash table
            py(`inventory_hash.add(${pyStr(result.name)}, {"type": "crop", "count": 1, "icon": ${pyStr(cropUrl)}, "crop_key": ${pyStr(slugify(result.name))}})`);

            // 2. Push harvest event onto stack.py
            window.runPython(`
    if 'stack' in globals():
        stack.push({'action': 'harvest', 'r': ${r}, 'c': ${c}, 'desc': 'Harvested ${result.name} at [${r}, ${c}]'})
            `);

            // 3. Log Console & Function Trace
            logConsole(`Harvested 1x ${result.name} from tile [${r}, ${c}]!`);
            logPythonTrace("Harvest Crop Action", [
                { file: "matrix_grid.py", fn: "grid.harvest_crop(r, c)", dsa: "2D Array State Reset" },
                { file: "hash.py", fn: "inventory_hash.add(crop_name, item)", dsa: "Linear Probing Hash Table Insertion" },
                { file: "stack.py", fn: "stack.push(action_dict)", dsa: "LIFO Stack Action Push" }
            ]);

            // 4. Update Hotbar & Grid UI
            if (typeof renderMinecraftHotbar === 'function') renderMinecraftHotbar();
            if (window.syncPythonToUI) window.syncPythonToUI();
            return true;
        } else if (result && result.wilted) {
            logConsole(`Warning: crop at [${r}, ${c}] is wilted! Clear it using the Shovel.`);
            return false;
        } else if (result && result.had_crop && !result.ready) {
            logConsole(`Warning: crop at [${r}, ${c}] is not ready for harvest yet!`);
            return false;
        } else {
            logConsole(`Warning: there is nothing to harvest at tile [${r}, ${c}]!`);
            return false;
        }
    } else if (activeTool === 'shovel') {
        // 1. Check if the tile actually has anything to clear first
        const canClear = window.runPython(`
    tile = grid.get_tile(${r}, ${c})
    bool(tile and (tile.is_tilled or tile.crop is not None or tile.is_watered or tile.is_fertilized or tile.is_wilted))
        `);

        if (!canClear) {
            logConsole(`Warning: tile [${r}, ${c}] is already flat raw soil!`);
            return false;
        }

        // 2. Execute shovel clear in Python and retrieve removed item name
        const removedName = window.runPython(`
    res = grid.shovel_clear_tile(${r}, ${c}, stack if 'stack' in globals() else None)
    str(res) if res else "tilled soil"
        `);

        // 3. Update Console, Function Trace Log, and UI
        logConsole(`Cleared ${removedName} from tile [${r}, ${c}]!`);

        logPythonTrace("Shovel (Looping Stack Pop)", [
            { file: "matrix_grid.py", fn: "grid.shovel_clear_tile(r, c, stack)", dsa: "2D Matrix Tile State Reversion" },
            { file: "stack.py", fn: "stack.pop_tile_actions(r, c)", dsa: "LIFO Stack Looping Pop Traversal" }
        ]);

        if (window.syncPythonToUI) window.syncPythonToUI();
        return true;
    }
    return false;
}

function advanceNextDay() {
    if (!pyReady()) return;

    const night = pyJson(`
import json
environment_queue.advance_day(grid)
_disaster = bool(getattr(grid, 'disaster_occurred', False))
_name = str(getattr(grid, 'last_disaster_name', '') or '')
if hasattr(grid, 'disaster_occurred'):
    grid.disaster_occurred = False
json.dumps({"disaster": _disaster, "name": _name})
    `);

    if (!night) {
        logConsole("Error: could not advance the day (see console for the Python error).");
        return;
    }

    userEnergy = maxEnergy;
    const gridEl = document.getElementById('soil-grid');

    if (night.disaster && night.name) {
        logConsole(`NIGHT DISASTER ALERT: A severe ${night.name} struck your field! Shielded crops absorbed damage!`);
        logPythonTrace(`Night Disaster: ${night.name}`, [
            { file: "queue.py", fn: "environment_queue.advance_day(grid)", dsa: "FIFO Queue Event Roll" },
            { file: "matrix_grid.py", fn: "grid.process_day_transition(season, weather, disaster)", dsa: "2D Matrix Grid Traversal O(R*C)" }
        ]);
        if (gridEl) {
            gridEl.classList.add('disaster-blink');
            setTimeout(() => gridEl.classList.remove('disaster-blink'), 3000);
        }
    } else {
        logConsole("Advanced to Next Day! Energy restored. Unwatered or out-of-season crops wilted!");
        logPythonTrace("Advanced Day Transition", [
            { file: "queue.py", fn: "environment_queue.advance_day(grid)", dsa: "FIFO Queue Advancement" },
            { file: "matrix_grid.py", fn: "grid.process_day_transition(season, weather)", dsa: "2D Matrix Traversal O(R*C)" }
        ]);
    }

    updateStatusUI();
    window.syncPythonToUI();
}

window.syncPythonToUI = function () {
    if (!pyReady()) return;

    const matrix = pyJson(`
import json

def _tile_to_dict(t):
    crop = t.crop
    return {
        "tilled": bool(t.is_tilled),
        "watered": bool(t.is_watered),
        "wilted": bool(t.is_wilted),
        "fertilized": bool(t.is_fertilized),
        "hp": getattr(t, 'hp', 100),
        "max_hp": getattr(t, 'max_hp', 100),
        "has_crop": crop is not None,
        "name": crop.name if crop else "",
        "symbol": crop.symbol if crop else "",
        "stage": t.growth_stage,
        "max_stage": crop.days_to_grow if crop else 1
    }

json.dumps([[_tile_to_dict(t) for t in row] for row in grid.grid], default=str)
    `);

    if (matrix) renderGridFromMatrix(matrix);
    renderMinecraftHotbar();
};

function renderGridFromMatrix(matrix) {
    const gridContainer = document.getElementById('soil-grid');
    if (!gridContainer) return;
    gridContainer.innerHTML = '';

    const cols = matrix.length ? matrix[0].length : GRID_COLS;

    matrix.forEach((row, r) => {
        row.forEach((tile, c) => {
            const el = document.createElement('div');
            el.className = 'soil-tile';
            el.setAttribute('role', 'gridcell');
            el.tabIndex = 0;
            if (tile.tilled) el.classList.add('tilled');
            if (tile.watered) el.classList.add('watered');
            if (tile.wilted) el.classList.add('wilted');
            if (tile.fertilized) el.classList.add('fertilized');

            let spriteHtml = "";
            let label = `Tile ${r},${c}`;

            if (tile.wilted) {
                spriteHtml = `<img class="tile-sprite" src="https://stardewvalleywiki.com/mediawiki/images/d/d0/Fiber_Stage_4_Fall.png" alt="Wilted" referrerpolicy="no-referrer" onerror="this.style.display='none'">`;
                label += ', wilted crop';
            } else if (tile.has_crop || tile.symbol) {
                const stageImgUrl = getCropStageImgUrl(tile);
                spriteHtml = `<img class="tile-sprite" src="${escapeHtml(stageImgUrl)}" alt="${escapeHtml(tile.name)}" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${GENERIC_CROP_ICON}'">`;
                if (tile.stage >= tile.max_stage) {
                    label += `, ${tile.name || 'crop'} ready`;
                } else {
                    label += `, ${tile.name || 'crop'} (Stage ${tile.stage}/${tile.max_stage})`;
                }
            } else if (tile.tilled) {
                label += ', tilled';
            }
            el.setAttribute('aria-label', label);

            // Construct Hover Status Tooltip
            let tooltipText = `Tile [${r}, ${c}]`;
            if (tile.wilted) {
                tooltipText += `\nStatus: Wilted Crop`;
            } else if (tile.has_crop || tile.symbol) {
                const cropName = tile.name || "Unknown Plant";
                const curStage = tile.stage || 0;
                const maxStage = tile.max_stage || 1;
                const hpVal = tile.hp !== undefined ? tile.hp : 100;
                const maxHpVal = tile.max_hp !== undefined ? tile.max_hp : 100;
                const isReady = curStage >= maxStage;

                tooltipText += `\nPlant: ${cropName}`;
                tooltipText += `\nGrowth: Day ${curStage}/${maxStage}${isReady ? ' (Ready to Harvest!)' : ''}`;
                tooltipText += `\nHP: ${hpVal}/${maxHpVal}`;
                tooltipText += `\nWatered: ${tile.watered ? 'Yes 💧' : 'No ☀️'}`;
                tooltipText += `\nFertilizer Shield: ${tile.fertilized ? 'Active 🧪' : 'None'}`;
            } else if (tile.tilled) {
                tooltipText += `\nStatus: Tilled Soil (Ready for Seeds)`;
                tooltipText += `\nWatered: ${tile.watered ? 'Yes 💧' : 'No ☀️'}`;
            } else {
                tooltipText += `\nStatus: Raw Soil (Needs Tilling with Hoe)`;
            }

            el.title = tooltipText; // Sets native hover tooltip

            let healthBarHtml = "";
            if (tile.has_crop && !tile.wilted) {
                const maxHp = Number(tile.max_hp) || 100;
                const hpPct = Math.max(0, Math.min(100, Math.floor(((Number(tile.hp) || 0) / maxHp) * 100)));
                const barColor = hpPct > 50 ? '#22c55e' : (hpPct > 20 ? '#eab308' : '#ef4444');
                healthBarHtml = `
                    <div class="crop-hp-bar-bg">
                        <div class="crop-hp-bar-fill" style="width: ${hpPct}%; background-color: ${barColor};"></div>
                    </div>
                `;
            }

            el.innerHTML = `
                <div class="tile-header">
                    <span class="tile-coord">${r},${c}</span>
                    ${tile.fertilized ? `<img class="fertilizer-badge" src="${FERTILIZER_ICON}" title="Shielded with Fertilizer" alt="Shielded" referrerpolicy="no-referrer">` : ''}
                </div>
                ${spriteHtml || '<span></span>'}
                ${healthBarHtml || '<span></span>'}
            `;
            el.onclick = () => handleTileClick(r, c);
            el.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    lastFocusedTile = { r, c };
                    handleTileClick(r, c);
                }
            };
            gridContainer.appendChild(el);
        });
    });

    if (lastFocusedTile) {
        const target = gridContainer.children[lastFocusedTile.r * cols + lastFocusedTile.c];
        if (target) target.focus({ preventScroll: true });
        lastFocusedTile = null;
    }
}

function renderFallbackGrid() {
    const gridContainer = document.getElementById('soil-grid');
    if (!gridContainer) return;
    gridContainer.innerHTML = '';
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            const el = document.createElement('div');
            el.className = 'soil-tile';
            el.setAttribute('role', 'gridcell');
            el.innerHTML = `<div class="tile-header"><span class="tile-coord">${r},${c}</span></div><span></span><span></span>`;
            gridContainer.appendChild(el);
        }
    }
}