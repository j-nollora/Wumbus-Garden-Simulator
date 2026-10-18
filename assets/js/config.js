/**
 * @file config.js
 * @description Master Configuration File & Global State Constants for Wumbus' Garden Simulator.
 * Defines global player resource limits, 5x5 soil matrix dimensions, energy costs,
 * external asset image URL mappings, weather channel forecast icons, and crop growth stage sprite registries.
 */

/* ==========================================================================
   1. Active Player State & Energy/Resource Limits
   ========================================================================== */

/** @type {string} Currently selected active farming tool ('hoe', 'water', 'plant', 'scythe', 'shovel', 'fertilizer'). */
let activeTool = "hoe";

/** @type {string|null} Key identifier of the active inventory item selected in the hotbar. */
let selectedInventoryKey = null;

/** @type {number} Current available player action energy. */
let userEnergy = 100;

/** @constant {number} Maximum baseline player action energy limit. */
const maxEnergy = 100;

/** @type {number} Current available water bucket volume in Liters (L). */
let userBucket = 5;

/** @type {number} Maximum current water bucket capacity in Liters (L). */
let maxBucket = 5;

/** @type {number} Current available gold coin balance. */
let userCoins = 200;

/* ==========================================================================
   2. Grid Matrix Dimensions & Action Cost Constants
   ========================================================================== */

/** @constant {number} Total rows in the soil matrix grid. */
const GRID_ROWS = 5;

/** @constant {number} Total columns in the soil matrix grid. */
const GRID_COLS = 5;

/** @constant {number} Energy cost consumed per single tile tool execution. */
const ENERGY_PER_ACTION = 5;

/** @constant {number} Energy cost consumed when refilling the watering bucket at the well. */
const WELL_ENERGY_COST = 10;

/** @constant {number} Minimum number of inventory hotbar slots rendered in the UI. */
const MIN_INVENTORY_SLOTS = 6;

/** @constant {number} Maximum retained lines in terminal console logs. */
const MAX_LOG_LINES = 120;

/** @constant {string} Inventory hash key for Plant Defense Fertilizer. */
const FERTILIZER_KEY = "Plant Defense Fertilizer";

/* ==========================================================================
   3. Operational Execution Flags & Engine Locks
   ========================================================================== */

/** @type {boolean} Flag indicating if multi-tile AOE tool execution was aborted mid-loop (e.g., empty bucket). */
let aoeAborted = false;

/** @type {Object|null} Stores row and column indices `{ r: number, c: number }` of the last focused tile for keyboard accessibility. */
let lastFocusedTile = null;

/** @type {boolean} State flag set to true once Pyodide WebAssembly runtime initialization completes. */
let pythonInitDone = false;

/* ==========================================================================
   4. Core System Asset & Weather Icon Mappings
   ========================================================================== */

/** @constant {string} Fallback URL icon for generic crops. */
const GENERIC_CROP_ICON =
  "https://stardewvalleywiki.com/mediawiki/images/c/c4/Parsnip.png";

/** @constant {string} Fallback URL icon for generic seed bags. */
const SEED_ICON =
  "https://stardewvalleywiki.com/mediawiki/images/d/d3/Parsnip_Seeds.png";

/** @constant {string} Asset icon URL for Plant Defense Fertilizer. */
const FERTILIZER_ICON =
  "https://fieldsofmistria.wiki.gg/images/thumb/Essence.png/30px-Essence.png?abcecb";

/** @constant {string} HUD icon URL for Sunny weather. */
const SUN_ICON =
  "https://stardewvalleywiki.com/mediawiki/images/d/d2/StatusSun.png";

/** @constant {string} HUD icon URL for Rainy weather. */
const RAIN_ICON =
  "https://stardewvalleywiki.com/mediawiki/images/3/3a/StatusRain.png";

/** @constant {string} HUD icon URL for Stormy weather. */
const STORM_ICON =
  "https://stardewvalleywiki.com/mediawiki/images/9/92/StormAnimated.gif";

/** @constant {string} HUD icon URL for Snowy weather. */
const SNOW_ICON =
  "https://stardewvalleywiki.com/mediawiki/images/c/c0/SnowAnimated.gif";

/* ==========================================================================
   5. Weather Channel 30-Day BST Forecast Asset Mappings
   ========================================================================== */

/**
 * Animated pixel-art GIF asset mappings for weather and disaster events
 * stored inside the 30-day Binary Search Tree (bst.py).
 * @constant {Object<string, string>}
 */
const FORECAST_ICON_MAP = {
  Sunny: "https://stardewvalleywiki.com/mediawiki/images/2/26/SunAnimated.gif",
  Rainy: "https://stardewvalleywiki.com/mediawiki/images/a/af/RainAnimated.gif",
  "Meteorite Strike":
    "https://stardewvalleywiki.com/mediawiki/images/a/a5/Magma_Sprite_Anim.gif",
  "Alien Escape":
    "https://stardewvalleywiki.com/mediawiki/images/c/c5/Wilderness_Golem_Anim.gif",
  "Green Rain Windstorm":
    "https://stardewvalleywiki.com/mediawiki/images/2/2b/GreenRainAnimated.gif",
  Earthquake:
    "https://stardewvalleywiki.com/mediawiki/images/e/ea/Duggy_Dangerous_Anim.gif",
};

/**
 * Header TV Screen GIF configurations for safe vs hazard forecast conditions.
 * @constant {Object<string, string>}
 */
const TV_FORECAST_CONFIG = {
  DANGER_GIF:
    "https://stardewvalleywiki.com/mediawiki/images/3/3b/LuckSkullMin.gif",
  SAFE_GIF:
    "https://stardewvalleywiki.com/mediawiki/images/8/8a/LuckStarMax.gif",
};

/* ==========================================================================
   6. Comprehensive Crop Database Sprite Registry
   ========================================================================== */

/**
 * Master Registry mapping crop names to item icons, seed icons, and growth stage sprites.
 * Growth stage tiers represent: [0: Seed/Sprout, 1: Early Growth, 2: Mid Growth, 3: Mature Harvestable].
 * @constant {Object<string, {item_icon: string, seed_icon: string, stage_images: Array<string>}>}
 */
const CROP_ASSETS = {
  Parsnip: {
    item_icon:
      "https://stardewvalleywiki.com/mediawiki/images/d/db/Parsnip.png",
    seed_icon:
      "https://stardewvalleywiki.com/mediawiki/images/d/d3/Parsnip_Seeds.png",
    stage_images: [
      "https://stardewvalleywiki.com/mediawiki/images/6/66/Parsnip_Stage_1.png",
      "https://stardewvalleywiki.com/mediawiki/images/6/69/Parsnip_Stage_3.png",
      "https://stardewvalleywiki.com/mediawiki/images/1/19/Parsnip_Stage_4.png",
      "https://stardewvalleywiki.com/mediawiki/images/2/21/Parsnip_Stage_5.png",
    ],
  },
  Cauliflower: {
    item_icon:
      "https://stardewvalleywiki.com/mediawiki/images/a/aa/Cauliflower.png",
    seed_icon:
      "https://stardewvalleywiki.com/mediawiki/images/b/bb/Cauliflower_Seeds.png",
    stage_images: [
      "https://stardewvalleywiki.com/mediawiki/images/4/45/Cauliflower_Stage_1.png",
      "https://stardewvalleywiki.com/mediawiki/images/e/e5/Cauliflower_Stage_3.png",
      "https://stardewvalleywiki.com/mediawiki/images/1/16/Cauliflower_Stage_4.png",
      "https://stardewvalleywiki.com/mediawiki/images/d/d7/Cauliflower_Stage_6.png",
    ],
  },
  Strawberry: {
    item_icon:
      "https://stardewvalleywiki.com/mediawiki/images/6/6d/Strawberry.png",
    seed_icon:
      "https://stardewvalleywiki.com/mediawiki/images/f/f2/Strawberry_Seeds.png",
    stage_images: [
      "https://stardewvalleywiki.com/mediawiki/images/2/2c/Strawberry_Stage_1.png",
      "https://stardewvalleywiki.com/mediawiki/images/d/d6/Strawberry_Stage_3.png",
      "https://stardewvalleywiki.com/mediawiki/images/6/65/Strawberry_Stage_5.png",
      "https://stardewvalleywiki.com/mediawiki/images/4/48/Strawberry_Stage_6.png",
    ],
  },
  Tomato: {
    item_icon: "https://stardewvalleywiki.com/mediawiki/images/9/9d/Tomato.png",
    seed_icon:
      "https://stardewvalleywiki.com/mediawiki/images/e/e3/Tomato_Seeds.png",
    stage_images: [
      "https://stardewvalleywiki.com/mediawiki/images/1/1f/Tomato_Stage_1.png",
      "https://stardewvalleywiki.com/mediawiki/images/e/e7/Tomato_Stage_3.png",
      "https://stardewvalleywiki.com/mediawiki/images/c/c2/Tomato_Stage_5.png",
      "https://stardewvalleywiki.com/mediawiki/images/b/bb/Tomato_Stage_6.png",
    ],
  },
  Corn: {
    item_icon: "https://stardewvalleywiki.com/mediawiki/images/f/f8/Corn.png",
    seed_icon:
      "https://stardewvalleywiki.com/mediawiki/images/d/d1/Corn_Seeds.png",
    stage_images: [
      "https://stardewvalleywiki.com/mediawiki/images/5/57/Corn_Stage_1.png",
      "https://stardewvalleywiki.com/mediawiki/images/d/db/Corn_Stage_3.png",
      "https://stardewvalleywiki.com/mediawiki/images/2/29/Corn_Stage_7.png",
      "https://stardewvalleywiki.com/mediawiki/images/9/9d/Corn_Stage_6.png",
    ],
  },
  Melon: {
    item_icon: "https://stardewvalleywiki.com/mediawiki/images/1/19/Melon.png",
    seed_icon:
      "https://stardewvalleywiki.com/mediawiki/images/5/5e/Melon_Seeds.png",
    stage_images: [
      "https://stardewvalleywiki.com/mediawiki/images/8/80/Melon_Stage_1.png",
      "https://stardewvalleywiki.com/mediawiki/images/a/aa/Melon_Stage_3.png",
      "https://stardewvalleywiki.com/mediawiki/images/c/cf/Melon_Stage_4.png",
      "https://stardewvalleywiki.com/mediawiki/images/6/6d/Melon_Stage_5.png",
    ],
  },
  Yam: {
    item_icon: "https://stardewvalleywiki.com/mediawiki/images/5/52/Yam.png",
    seed_icon:
      "https://stardewvalleywiki.com/mediawiki/images/e/e9/Yam_Seeds.png",
    stage_images: [
      "https://stardewvalleywiki.com/mediawiki/images/d/d4/Yam_Stage_1.png",
      "https://stardewvalleywiki.com/mediawiki/images/5/5c/Yam_Stage_2.png",
      "https://stardewvalleywiki.com/mediawiki/images/9/9d/Yam_Stage_4.png",
      "https://stardewvalleywiki.com/mediawiki/images/6/64/Yam_Stage_5.png",
    ],
  },
  Pumpkin: {
    item_icon:
      "https://stardewvalleywiki.com/mediawiki/images/6/64/Pumpkin.png",
    seed_icon:
      "https://stardewvalleywiki.com/Special:FilePath/Pumpkin_Seeds.png",
    stage_images: [
      "https://stardewvalleywiki.com/mediawiki/images/0/09/Pumpkin_Stage_1.png",
      "https://stardewvalleywiki.com/mediawiki/images/c/cf/Pumpkin_Stage_3.png",
      "https://stardewvalleywiki.com/mediawiki/images/d/dd/Pumpkin_Stage_5.png",
      "https://stardewvalleywiki.com/mediawiki/images/9/9d/Pumpkin_Stage_6.png",
    ],
  },
  Grape: {
    item_icon: "https://stardewvalleywiki.com/mediawiki/images/c/c2/Grape.png",
    seed_icon:
      "https://stardewvalleywiki.com/mediawiki/images/d/de/Grape_Starter.png",
    stage_images: [
      "https://stardewvalleywiki.com/mediawiki/images/b/be/Grape_Stage_1.png",
      "https://stardewvalleywiki.com/mediawiki/images/9/9f/Grape_Stage_2.png",
      "https://stardewvalleywiki.com/mediawiki/images/e/ea/Grape_Stage_5.png",
      "https://stardewvalleywiki.com/mediawiki/images/1/12/Grape_Stage_6.png",
    ],
  },
  Powdermelon: {
    item_icon:
      "https://stardewvalleywiki.com/mediawiki/images/a/aa/Powdermelon.png",
    seed_icon:
      "https://stardewvalleywiki.com/Special:FilePath/Powdermelon_Seeds.png",
    stage_images: [
      "https://stardewvalleywiki.com/mediawiki/images/6/6f/Powdermelon_Stage_1.png",
      "https://stardewvalleywiki.com/mediawiki/images/c/c7/Powdermelon_Stage_2.png",
      "https://stardewvalleywiki.com/mediawiki/images/0/0d/Powdermelon_Stage_4.png",
      "https://stardewvalleywiki.com/mediawiki/images/d/db/Powdermelon_Stage_5.png",
    ],
  },
};