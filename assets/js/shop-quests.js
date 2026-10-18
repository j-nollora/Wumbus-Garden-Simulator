/**
 * @file shop-quests.js
 * @description Quest Hand-ins, Item Selling, Fertilizer Store, and Mystery Bag Purchases for Wumbus' Garden Simulator.
 * Interfaces with Python's hierarchical quest tree (hierarchical_tree_and_traversals.py),
 * inventory hash table (hash.py), probabilistic seed roller (paradigms.py), and static crop registry (oop_concepts.py).
 */

/* ==========================================================================
   1. Quest Submission & EXP Leveling System
   ========================================================================== */

/**
 * Validates and submits the active selected inventory item to fulfill Wumbus' current quest.
 * Deducts required crop counts, awards EXP and Coins, evaluates level-up bonuses, and logs DSA traces.
 */
function submitQuestCrop() {
  if (!pyReady()) return;

  // Validate that player has selected an inventory item
  if (!selectedInventoryKey) {
    logConsole("Error: select a harvested crop from your inventory first!");
    return;
  }

  // Set selected inventory key in Python global memory
  py(`_selected_key = ${pyStr(selectedInventoryKey)}`);

  // Evaluate quest hand-in logic inside Python WASM runtime
  const res = pyJson(`
import json

def _process_quest():
    try:
        # 1. Fetch current active season
        s = environment_queue.get_current_season() if 'environment_queue' in globals() else "Spring"
        s_clean = str(s).split()[0].strip()

        # 2. Retrieve quest crop requirement from Hierarchical Quest Tree
        if hasattr(quest_tree, 'get_current_req'):
            req_crop, req_amt = quest_tree.get_current_req(s_clean)
        else:
            req_crop = getattr(quest_tree.current_node, 'required_crop', 'Parsnip')
            req_amt = getattr(quest_tree.current_node, 'required_amount', 1)

        req_amt = int(req_amt)

        # 3. Inspect target item in inventory linear probing hash table
        item = inventory_hash.get(_selected_key)
        if not item or not isinstance(item, dict):
            return json.dumps({"status": "not_crop"})

        is_crop = (str(item.get("type", "")).lower() == "crop")
        count = int(item.get("count", 0))

        match = (str(_selected_key).strip().lower() == str(req_crop).strip().lower())

        # 4. Perform quest requirement validations
        if not is_crop:
            return json.dumps({"status": "not_crop"})
        if not match:
            return json.dumps({"status": "wrong_crop", "req_crop": str(req_crop), "req_amt": req_amt})
        if count < req_amt:
            return json.dumps({"status": "not_enough", "req_crop": str(req_crop), "req_amt": req_amt})

        # 5. Deduct required crop quantity from inventory hash table
        for _ in range(req_amt):
            inventory_hash.consume(_selected_key)

        exp = int(getattr(quest_tree.current_node, 'exp_reward', 150))
        coins = int(getattr(quest_tree.current_node, 'coin_reward', 50))
        
        # 6. Add EXP to quest tree and evaluate level-up results
        exp_res = quest_tree.add_exp(exp)
        if isinstance(exp_res, tuple):
            lvl_up, bonus_coins = exp_res
        else:
            lvl_up, bonus_coins = bool(exp_res), 0

        new_node = quest_tree.current_node
        return json.dumps({
            "status": "success",
            "data": {
                "exp": exp,
                "coins": coins,
                "bonus_coins": int(bonus_coins),
                "level_up": lvl_up,
                "level": int(getattr(new_node, 'level', 1)),
                "title": str(getattr(new_node, 'title', '')),
                "perk": str(getattr(new_node, 'perk_description', getattr(new_node, 'perk', ''))),
                "req_crop": str(req_crop),
                "req_amt": req_amt
            }
        })
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

_process_quest()
    `);

  // Handle execution error responses
  if (!res) {
    logConsole("Error: Could not evaluate quest submission in Python.");
    return;
  }

  if (res.status === "error") {
    logConsole(
      `Error during quest submission: ${res.message || "Unknown error"}`,
    );
    return;
  }

  if (res.status === "not_crop") {
    logConsole(`Error: ${selectedInventoryKey} is not a valid harvested crop!`);
    return;
  }
  if (res.status === "wrong_crop") {
    logConsole(
      `Wumbus: "Ribbit! I do not want ${selectedInventoryKey}! Bring me ${res.req_amt}x ${res.req_crop}!"`,
    );
    return;
  }
  if (res.status === "not_enough") {
    logConsole(
      `Wumbus: "Ribbit! You don't have enough! I need ${res.req_amt}x ${res.req_crop}!"`,
    );
    return;
  }

  // Handle successful quest submission
  const data = res.data;
  let payout = Number(data.coins) || 0;

  if (data.level_up) {
    const bonus = Number(data.bonus_coins) || 0;
    payout += bonus;

    logConsole(
      `LEVEL UP! Wumbus advanced to Level ${data.level} (${data.title})! Unlocked: ${data.perk}`,
    );
    logConsole(
      `Quest Completed! (+${data.exp} EXP, +${data.coins} Coins) + LEVEL BONUS (+${bonus} Coins)!`,
    );
  } else {
    logConsole(
      `Quest Hand-in Successful! Received +${data.exp} EXP & +${data.coins} Coins!`,
    );
  }

  // Log DSA execution trace for quest processing
  logPythonTrace("Quest Submission Hand-In", [
    {
      file: "queue.py",
      fn: "environment_queue.get_current_season()",
      dsa: "Queue State Reading",
    },
    {
      file: "hierarchical_tree_and_traversals.py",
      fn: "quest_tree.get_current_req(season)",
      dsa: "Tree Lookup",
    },
    {
      file: "hash.py",
      fn: "inventory_hash.get(key) / consume(key)",
      dsa: "Hash Table Linear Probing",
    },
    {
      file: "hierarchical_tree_and_traversals.py",
      fn: "quest_tree.add_exp(exp)",
      dsa: "Parent-Child Node Traversal",
    },
  ]);

  addCoins(payout);
  clearSelectionIfEmpty();
  renderMinecraftHotbar();
  updateStatusUI();
}
window.submitQuestCrop = submitQuestCrop;

/* ==========================================================================
   2. Crop Selling Interface
   ========================================================================== */

/**
 * Sells 1x unit of the currently selected harvested crop to Wumbus for gold coins.
 */
function sellHarvestedCrop() {
  if (!pyReady()) return;

  if (!selectedInventoryKey) {
    logConsole("Error: select a harvested crop from your inventory to sell!");
    return;
  }

  // Verify that target selected item is a harvested crop
  const isCrop = py(
    `(lambda _i: _i.get("type") == "crop" if _i else False)(inventory_hash.get(${pyStr(selectedInventoryKey)}))`,
  );
  if (!isCrop) {
    logConsole(`Error: ${selectedInventoryKey} is not a valid crop to sell!`);
    return;
  }

  // Retrieve base sell price from static CROP_DATABASE registry
  const sellPrice =
    Number(
      py(
        `getattr(CROP_DATABASE.get(${pyStr(selectedInventoryKey)}), 'sell_price', 30)`,
      ),
    ) || 30;

  // Consume crop unit from hash table and grant coins
  consumeItem(selectedInventoryKey);
  addCoins(sellPrice);
  logConsole(
    `Sold 1x ${selectedInventoryKey} to Wumbus for +${sellPrice} Coins!`,
  );

  clearSelectionIfEmpty();
  renderMinecraftHotbar();
  updateStatusUI();
}

/* ==========================================================================
   3. Fertilizer Store & Seed Bag Economy
   ========================================================================== */

/**
 * Purchases 1x Plant Defense Fertilizer unit and inserts it into inventory_hash.
 * @param {number} [cost=20] - Gold coin cost of fertilizer.
 */
function buyFertilizer(cost = 20) {
  if (!pyReady()) {
    logConsole("Error: the Python engine is still loading.");
    return;
  }

  if (userCoins < cost) {
    logConsole("Not enough coins!");
    return;
  }

  // Add fertilizer item to inventory hash table
  const added = py(`
inventory_hash.add(${pyStr(FERTILIZER_KEY)}, {"type": "fertilizer", "count": 1, "icon": ${pyStr(FERTILIZER_ICON)}})
True
    `);
  if (added !== true) return;

  addCoins(-cost);
  selectInventoryItem(FERTILIZER_KEY);
  updateStatusUI();
  logConsole(`Purchased ${FERTILIZER_KEY}`);

  // Log DSA execution trace for hash insertion
  logPythonTrace("Purchased Fertilizer", [
    {
      file: "hash.py",
      fn: "inventory_hash.add(FERTILIZER_KEY, item)",
      dsa: "Linear Probing Hash Table Insertion",
    },
    {
      file: "oop_concepts.py",
      fn: "Fertilizer Item Lookup",
      dsa: "Static Property Encapsulation",
    },
  ]);
}

/**
 * Purchases a Tiered Mystery Seed Bag (Tier 1, 2, or 3), executes a greedy probabilistic
 * seasonal seed roll in paradigms.py, and adds the rolled seed item to inventory_hash.
 * @param {number} tier - Bag rarity tier (1, 2, or 3).
 * @param {number} cost - Gold coin price.
 */
function buyMysteryBag(tier, cost) {
  if (!pyReady()) {
    logConsole("Error: the Python engine is still loading.");
    return;
  }

  if (userCoins < cost) {
    logConsole("Not enough coins!");
    return;
  }

  const safeTier = Math.min(3, Math.max(1, Math.trunc(Number(tier)) || 1));

  // Execute seasonal seed selection directly in Pyodide WASM environment
  const rawResult = py(`
def _roll_bag():
    try:
        if 'buy_seasonal_mystery_bag' in globals():
            fn = buy_seasonal_mystery_bag
        else:
            from paradigms import buy_seasonal_mystery_bag as fn
            
        s = environment_queue.get_current_season() if 'environment_queue' in globals() else "Spring"
        s_clean = str(s).split()[0].strip()
        
        crop_obj = fn(${safeTier}, s_clean)
        if crop_obj and hasattr(crop_obj, 'name'):
            return str(crop_obj.name)
        return "Parsnip"
    except Exception as e:
        print("Mystery Bag Python Error:", e)
        return "Parsnip"

_roll_bag()
    `);

  // Fallback check to guarantee valid crop name string
  const cropName =
    typeof rawResult === "string" && rawResult.trim().length > 0
      ? rawResult.trim()
      : "Parsnip";

  const seedKey = `${cropName} Seed`;

  // Insert seed item into Python inventory_hash
  const added = py(`
inventory_hash.add(${pyStr(seedKey)}, {
    "type": "seed", 
    "count": 1, 
    "icon": ${pyStr(getSeedImgUrl(cropName))}, 
    "crop_key": ${pyStr(slugify(cropName))}
})
True
    `);

  addCoins(-cost);
  selectInventoryItem(seedKey);
  updateStatusUI();
  logConsole(`T${safeTier} Bag rolled ${seedKey} [cost: ${cost}]`);

  // Log DSA execution trace for seed bag rolling and insertion
  logPythonTrace("Bought Mystery Seed Bag & Rolled Seed", [
    {
      file: "queue.py",
      fn: "environment_queue.get_current_season()",
      dsa: "FIFO Queue State Query",
    },
    {
      file: "paradigms.py",
      fn: "buy_seasonal_mystery_bag(tier, season)",
      dsa: "Greedy Probabilistic Bag Roll",
    },
    {
      file: "oop_concepts.py",
      fn: "CROP_DATABASE.values() Lookup",
      dsa: "Object Property Matching",
    },
    {
      file: "hash.py",
      fn: "inventory_hash.add(seedKey, item)",
      dsa: "Hash Table Insertion",
    },
  ]);
}

/* ==========================================================================
   4. Shop Seasonal Crop Preview Grid Renderer
   ========================================================================== */

/**
 * Dynamically queries Python CROP_DATABASE for crops matching the current active season,
 * rendering a preview badge list inside Wumbus' Mystery Shop modal window.
 */
function renderShopSeasonalCrops() {
  const container =
    document.getElementById("shop-crop-list") ||
    document.getElementById("shop-seasonal-crops-list") ||
    document.getElementById("shop-crops-preview");
  if (!container) return;

  container.innerHTML = "";

  let season = "Spring";
  let crops = [];

  if (pyReady()) {
    const data = pyJson(`
import json
try:
    _s = environment_queue.get_current_season()
except Exception:
    _s = "Spring"
_season = (str(_s).split() or ["Spring"])[0].strip()
_key = "fall" if _season.lower() == "autumn" else _season.lower()
json.dumps({
    "season": _season,
    "crops": [
        {"name": c.name, "rarity": c.rarity, "season": c.season}
        for c in CROP_DATABASE.values()
        if str(c.season).lower() == _key
    ]
})
        `);
    if (data) {
      season = data.season || season;
      crops = Array.isArray(data.crops) ? data.crops : [];
    }
  }

  // Update shop seasonal header icon and title text
  const titleEl = document.getElementById("shop-season-title");
  if (titleEl) {
    const icon = titleEl.querySelector("img");
    const label = titleEl.querySelector("span");
    if (icon) icon.src = getSeasonIconUrl(season);
    if (label) label.textContent = `${season} crops in seed bags`;
  }

  if (crops.length === 0) {
    container.innerHTML = `<p style="font-size:0.8rem; opacity:0.6; padding:8px;">No seasonal preview available.</p>`;
    return;
  }

  // Render individual seasonal crop preview items
  crops.forEach((crop) => {
    const itemEl = document.createElement("div");
    itemEl.className = "shop-crop-item";
    itemEl.style.cssText =
      "display:inline-flex; align-items:center; gap:6px; background:rgba(0,0,0,0.05); padding:4px 8px; border-radius:6px; margin:3px;";

    const iconUrl = getSeedImgUrl(crop.name);

    itemEl.innerHTML = `
            <img src="${escapeHtml(iconUrl)}" alt="${escapeHtml(crop.name)}" referrerpolicy="no-referrer" style="width:20px; height:20px; object-fit:contain;" onerror="this.onerror=null;this.src='${GENERIC_CROP_ICON}'">
            <span style="font-size:0.75rem; font-weight:bold;">${escapeHtml(crop.name)}</span>
            <span style="font-size:0.65rem; opacity:0.7; text-transform:capitalize;">(${escapeHtml(crop.rarity)})</span>
        `;
    container.appendChild(itemEl);
  });
}