/**
 * @file inventory.js
 * @description Hotbar Inventory Management & Item Rendering Controller.
 * Manages item icon resolution (CROP_ASSETS database fallbacks), normalization of linear probing hash table
 * items from Python WASM (hash.py), interactive hotbar slot generation, item selection, and tool auto-switching.
 */

/* ==========================================================================
   1. Asset URL Resolvers & Image Fallbacks
   ========================================================================== */

/**
 * Resolves crop item icon URL from the CROP_ASSETS global configuration.
 * @param {string} name - Crop item name key.
 * @returns {string} Image URL path.
 */
window.getCropImgUrl =
  window.getCropImgUrl ||
  function (name) {
    const assets = CROP_ASSETS[name];
    return assets ? assets.item_icon : GENERIC_CROP_ICON;
  };

/**
 * Resolves item image URL wrapper.
 * @param {string} name - Item name key.
 * @returns {string} Image URL path.
 */
window.getItemImgUrl =
  window.getItemImgUrl ||
  function (name) {
    return itemImg({ key: name });
  };

/**
 * Resolves seed bag icon URL for a given crop key.
 * @param {string} cropKey - Target crop identifier.
 * @returns {string} Seed bag image URL path.
 */
function getSeedImgUrl(cropKey) {
  const assets = CROP_ASSETS[cropKey];
  return assets ? assets.seed_icon : SEED_ICON;
}

/**
 * Main asset resolver that inspects an inventory item object (fertilizer, seed, or harvested crop)
 * and determines its proper display icon URL.
 *
 * @param {Object} item - Inventory item object representation.
 * @returns {string} Image URL path.
 */
function itemImg(item) {
  if (!item) return GENERIC_CROP_ICON;

  const jsItem = normalizePy(item);
  if (!jsItem || typeof jsItem !== "object") return GENERIC_CROP_ICON;

  // Direct absolute HTTP image URL check
  if (typeof jsItem.icon === "string" && jsItem.icon.startsWith("http")) {
    return jsItem.icon;
  }

  const rawKey = String(jsItem.key || jsItem.name || "").trim();
  const lowerKey = rawKey.toLowerCase();

  // Plant Defense Fertilizer icon check
  if (lowerKey.includes("fertilizer") || jsItem.type === "fertilizer") {
    return FERTILIZER_ICON;
  }

  // Seed bag icon check
  if (lowerKey.includes("seed") || jsItem.type === "seed") {
    const cropName = jsItem.crop_key || rawKey.replace(/\s+seed$/i, "").trim();
    const assets = CROP_ASSETS[cropName];
    return assets ? assets.seed_icon : SEED_ICON;
  }

  // Harvested crop icon check
  const cropName = jsItem.crop_key || rawKey;
  const assets = CROP_ASSETS[cropName];
  return assets ? assets.item_icon : GENERIC_CROP_ICON;
}

/* ==========================================================================
   2. Inventory Item Normalization & Python Hash Table Bridge
   ========================================================================== */

/**
 * Normalizes raw inventory tuples or dict representations retrieved from Python's `InventoryHashTable`.
 *
 * @param {*} raw - Raw item payload from Python memory environment.
 * @returns {Object|null} Normalized item object `{ key: string, count: number, ... }` or null if invalid.
 */
function normalizeInventoryItem(raw) {
  if (!raw) return null;
  let item = raw;

  // Normalize tuple key-value pairs (e.g., ["Parsnip Seed", { count: 3 }])
  if (Array.isArray(raw) && raw.length === 2 && typeof raw[0] === "string") {
    const extra =
      raw[1] && typeof raw[1] === "object" ? raw[1] : { count: raw[1] };
    item = Object.assign({ key: raw[0] }, extra);
  }

  if (!item || typeof item !== "object") return null;

  const key = String(
    item.key !== undefined
      ? item.key
      : item.name !== undefined
        ? item.name
        : "",
  ).trim();

  if (!key) return null;
  const count = item.count !== undefined ? Number(item.count) : 1;

  return Object.assign({}, item, { key, count });
}

/**
 * Queries the linear probing hash table in Python (`inventory_hash.to_list()`)
 * and returns an array of normalized active inventory items.
 *
 * @returns {Array<Object>} List of active inventory items with `count > 0`.
 */
function getInventoryItems() {
  const raw = py("inventory_hash.to_list()");
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeInventoryItem).filter((i) => i && i.count > 0);
}

/**
 * Fetches the available count for a specific item key directly from the Python hash table.
 * @param {string} key - Item key name.
 * @returns {number} Available item count.
 */
function getInventoryCount(key) {
  const n = py(
    `(lambda _i: _i.get("count", 0) if _i else 0)(inventory_hash.get(${pyStr(key)}))`,
  );
  return Number(n) || 0;
}

/**
 * Deducts 1 unit of the target item from Python's inventory hash table.
 * @param {string} key - Item key name.
 */
function consumeItem(key) {
  py(`inventory_hash.consume(${pyStr(key)})`);
}

/**
 * Resets the active selected inventory key if the item count drops to zero or below.
 */
function clearSelectionIfEmpty() {
  if (selectedInventoryKey && getInventoryCount(selectedInventoryKey) <= 0) {
    selectedInventoryKey = null;
  }
}

/* ==========================================================================
   3. Hotbar UI Rendering & Interactive Slot Controls
   ========================================================================== */

/**
 * Renders the Minecraft-style hotbar UI grid container, creating interactive item slot elements
 * with count badges, keyboard accessibility navigation, and active selection borders.
 */
function renderInventoryUI() {
  const gridEl =
    document.getElementById("mc-inventory-grid") ||
    document.getElementById("inventory-grid");
  if (!gridEl) return;

  const items = pyReady() ? getInventoryItems() : [];

  // Deselect key if item was completely consumed/removed
  if (
    selectedInventoryKey &&
    !items.some(
      (i) => i.key.toLowerCase() === selectedInventoryKey.toLowerCase(),
    )
  ) {
    selectedInventoryKey = null;
  }

  gridEl.innerHTML = "";
  const slotCount = Math.max(MIN_INVENTORY_SLOTS, items.length);

  // Generate hotbar slots
  for (let i = 0; i < slotCount; i++) {
    const item = items[i];
    const slotEl = document.createElement("div");
    slotEl.className = "mc-slot";

    // Render empty placeholder slot
    if (!item) {
      slotEl.innerHTML = `<span style="opacity:0.2; font-size:0.65rem;">Empty</span>`;
      gridEl.appendChild(slotEl);
      continue;
    }

    const itemKey = item.key;
    const count = item.count;
    const imgSrc = itemImg(item);
    const fallback = item.type === "crop" ? GENERIC_CROP_ICON : SEED_ICON;

    // Apply active selection border highlight
    if (
      selectedInventoryKey &&
      selectedInventoryKey.toLowerCase() === itemKey.toLowerCase()
    ) {
      slotEl.classList.add("selected");
      slotEl.style.border = "2px solid #55ff55";
    }

    // ARIA & Accessibility Attributes
    slotEl.style.cursor = "pointer";
    slotEl.tabIndex = 0;
    slotEl.setAttribute("role", "button");
    slotEl.setAttribute("aria-label", `${itemKey} x${count}`);
    slotEl.title = `${itemKey} x${count}`;

    slotEl.innerHTML = `
            <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(itemKey)}" referrerpolicy="no-referrer" style="width:28px; height:28px; object-fit:contain; pointer-events:none;" onerror="this.onerror=null;this.src='${fallback}'">
            ${count > 1 ? `<span class="mc-badge">${count}</span>` : ""}
        `;

    // Click & Keyboard Enter/Space selection event listeners
    slotEl.addEventListener("click", (e) => {
      e.stopPropagation();
      selectInventoryItem(itemKey);
    });
    slotEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectInventoryItem(itemKey);
      }
    });

    gridEl.appendChild(slotEl);
  }
}

/**
 * Selects an inventory item, automatically equipping the corresponding active tool
 * (Seeder for seeds, Fertilizer for fertilizer) and logging usage instructions.
 *
 * @param {string} itemKey - Target item identifier.
 */
function selectInventoryItem(itemKey) {
  if (!itemKey) return;

  selectedInventoryKey = itemKey;
  const lowerKey = itemKey.toLowerCase();

  // Auto-switch tools based on item type
  if (lowerKey.includes("fertilizer")) {
    setTool("fertilizer", true);
    logConsole(`Click on a tile to apply!`);
  } else if (lowerKey.includes("seed")) {
    setTool("plant", true);
    logConsole(`Click on a tilled tile to plant!`);
  } else {
    logConsole(`Selected ${itemKey}.`);
  }

  renderMinecraftHotbar();
}

/**
 * Synchronizes tool selection states, re-renders hotbar inventory slots,
 * and updates the active selected item text indicator line.
 */
function renderMinecraftHotbar() {
  syncToolButtons();
  renderInventoryUI();
  const indicator = document.getElementById("active-item-indicator");
  if (indicator)
    indicator.textContent = `Selected: ${selectedInventoryKey || "None"}`;
}
window.renderMinecraftHotbar = renderMinecraftHotbar;