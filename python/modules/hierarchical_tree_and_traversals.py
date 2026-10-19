# python/modules/hierarchical_tree_and_traversals.py
"""
Hierarchical N-ary Tree & Player Progression Module
===================================================
This module implements a Hierarchical Progression Tree data structure to handle 
player rank progression, seasonal farming quests, EXP accumulation, level-up milestones, 
and tool upgrades (AOE range expansion and watering can bucket capacity).

Data Structures & OOP Architecture:
-----------------------------------
1. QuestNode (Tree Node Component):
   - Represents a distinct rank node in the farming progression hierarchy.
   - Stores rank titles, seasonal crop requirements, EXP and coin reward values, 
     perk descriptions, unlocked tool Area-of-Effect (AOE) dimensions, max bucket capacities, 
     and child node pointers.

2. QuestProgressionTree (Hierarchical N-ary Tree Controller):
   - Manages tree node traversal using child pointers (`self.current_node`).
   - Computes EXP accumulation thresholds and advances the tree pointer upon level-up milestones.
   - Provides getter interfaces for active quest objectives, tool AOE dimensions, and watering can capacities.
"""

class QuestNode:
    """
    Individual Node Component in the Player Progression Tree Hierarchy.

    Acts as a state container defining player farming ranks, seasonal requirements, 
    rewards, level-up bonuses, and unlocked tool upgrades.

    Attributes:
        level (int): Player progression rank number (1 to 6).
        title (str): Player's farming rank title (e.g., "Novice Gardener").
        quest_type (str): Objective category label (e.g., "Basic Harvest", "Hydration Upgrade").
        seasonal_crops (dict): Mapping of season string ("Spring", "Summer", "Fall", "Winter")
            to a tuple containing `(crop_name, required_quantity)`.
        exp_reward (int): EXP granted per successful quest turn-in.
        coin_reward (int): Base gold coins earned per quest turn-in.
        level_up_bonus (int): One-time gold coin bonus awarded upon unlocking this rank.
        perk_description (str): Human-readable summary of unlocks gained at this rank.
        unlocked_aoe (int): Active tool Area-of-Effect dimensions (1 for 1x1, 2 for 2x2, 3 for 3x3).
        max_bucket (int): Watering can capacity limit in liters (5L, 8L, 10L, 14L, 18L, 25L).
        children (list of QuestNode): Child node pointers forming the N-ary tree structure.
    """

    def __init__(self, level, title, quest_type, seasonal_crops, exp_reward, coin_reward, 
                 level_up_bonus, perk_description, unlocked_aoe=1, max_bucket=5):
        """
        Initializes a QuestNode with rank attributes, rewards, tool upgrades, and an empty children list.
        
        Args:
            level (int): Rank index (1-6).
            title (str): Rank display title.
            quest_type (str): Quest category identifier.
            seasonal_crops (dict): Map of season to `(crop_name, required_amount)`.
            exp_reward (int): EXP points rewarded per quest turn-in.
            coin_reward (int): Base gold coins rewarded per quest turn-in.
            level_up_bonus (int): Bonus gold granted upon reaching this node.
            perk_description (str): Description of perks unlocked at this rank.
            unlocked_aoe (int, optional): Unlocked tool range dimension. Defaults to 1.
            max_bucket (int, optional): Unlocked watering can capacity in liters. Defaults to 5.
            
        Time Complexity: O(1) constant time initialization.
        """
        self.level = level
        self.title = title
        self.quest_type = quest_type
        self.seasonal_crops = seasonal_crops
        self.exp_reward = exp_reward
        self.coin_reward = coin_reward
        self.level_up_bonus = level_up_bonus
        self.perk_description = perk_description
        self.unlocked_aoe = unlocked_aoe
        self.max_bucket = max_bucket
        self.children = []

    def get_required_crop_info(self, current_season="Spring"):
        """
        Retrieves the required crop name and target quantity for the current active season.

        Args:
            current_season (str, optional): Active season ("Spring", "Summer", "Fall", "Winter"). 
                Defaults to "Spring".

        Returns:
            tuple: `(crop_name, required_quantity)` tuple matching the current season. 
                Falls back to Spring requirements if the season key is missing.

        Time Complexity: O(1) direct dictionary lookup.
        """
        season_key = str(current_season).split()[0].strip().capitalize()
        return self.seasonal_crops.get(season_key, self.seasonal_crops.get("Spring", ("Parsnip", 1)))


class QuestProgressionTree:
    """
    Data Structure: 6-Level Hierarchical Progression Tree.
    -----------------------------------------------------
    Manages player rank progression nodes, EXP accumulation, seasonal quest objectives, 
    level-up milestones, tool AOE upgrades, and watering can expansions.

    Attributes:
        root (QuestNode): Pointer to the root node (Level 1: Novice Gardener).
        current_node (QuestNode): Pointer to the player's active progression node.
        current_exp (int): Player's current accumulated EXP toward the next rank threshold.
        level_thresholds (dict): Mapping of level rank numbers to required EXP thresholds.
    """

    def __init__(self):
        """
        Constructs the 6-Level Progression Tree, creates QuestNode instances, 
        wires parent-child tree pointers, and initializes player EXP state.
        
        Time Complexity: O(1) static tree structure construction.
        """
        # Level 1: Starter Rank — Basic Single-Tile Farming (Root Node)
        node1 = QuestNode(
            level=1,
            title="Novice Gardener",
            quest_type="Basic Harvest",
            seasonal_crops={
                "Spring": ("Parsnip", 2),
                "Summer": ("Tomato", 2),
                "Fall": ("Yam", 2),
                "Winter": ("Powdermelon", 1)
            },
            exp_reward=100,
            coin_reward=40,
            level_up_bonus=0,
            perk_description="Starter Gear (1x1 Tool Range, 5L Water Can)",
            unlocked_aoe=1,
            max_bucket=5
        )

        # Level 2: Apprentice Rank — Expanded Water Capacity
        node2 = QuestNode(
            level=2,
            title="Apprentice Planter",
            quest_type="Hydration Upgrade",
            seasonal_crops={
                "Spring": ("Cauliflower", 2),
                "Summer": ("Corn", 2),
                "Fall": ("Pumpkin", 2),
                "Winter": ("Powdermelon", 2)
            },
            exp_reward=180,
            coin_reward=80,
            level_up_bonus=200,
            perk_description="Expanded 8L Water Can +200 Gold Bonus",
            unlocked_aoe=1,
            max_bucket=8
        )

        # Level 3: Journeyman Rank — 2x2 Area-of-Effect Tools
        node3 = QuestNode(
            level=3,
            title="Journeyman Farmer",
            quest_type="Area Cultivation",
            seasonal_crops={
                "Spring": ("Cauliflower", 3),
                "Summer": ("Corn", 3),
                "Fall": ("Pumpkin", 3),
                "Winter": ("Powdermelon", 3)
            },
            exp_reward=280,
            coin_reward=150,
            level_up_bonus=300,
            perk_description="Unlocked 2x2 AOE Tools & 10L Can +300 Gold Bonus",
            unlocked_aoe=2,
            max_bucket=10
        )

        # Level 4: Expert Rank — High-Yield Crops & Shielding
        node4 = QuestNode(
            level=4,
            title="Expert Cultivator",
            quest_type="Advanced Harvest",
            seasonal_crops={
                "Spring": ("Strawberry", 2),
                "Summer": ("Melon", 2),
                "Fall": ("Grape", 2),
                "Winter": ("Powdermelon", 4)
            },
            exp_reward=450,
            coin_reward=300,
            level_up_bonus=500,
            perk_description="Expanded 14L Water Can +500 Gold Bonus",
            unlocked_aoe=2,
            max_bucket=14
        )

        # Level 5: Master Rank — 3x3 Master AOE Tools
        node5 = QuestNode(
            level=5,
            title="Master Agriculturalist",
            quest_type="Royal Supply",
            seasonal_crops={
                "Spring": ("Strawberry", 4),
                "Summer": ("Melon", 4),
                "Fall": ("Grape", 4),
                "Winter": ("Powdermelon", 5)
            },
            exp_reward=700,
            coin_reward=600,
            level_up_bonus=800,
            perk_description="Unlocked 3x3 Master AOE Tools & 18L Can +800 Gold Bonus",
            unlocked_aoe=3,
            max_bucket=18
        )

        # Level 6: Grandmaster Rank — Terminal Leaf Node Cap
        node6 = QuestNode(
            level=6,
            title="Grandmaster Realm Hero",
            quest_type="Endgame Mastery",
            seasonal_crops={
                "Spring": ("Strawberry", 6),
                "Summer": ("Melon", 6),
                "Fall": ("Grape", 6),
                "Winter": ("Powdermelon", 6)
            },
            exp_reward=1500,
            coin_reward=1500,
            level_up_bonus=1500,
            perk_description="Max Rank Achieved! 25L Can & Full Kingdom Restoration",
            unlocked_aoe=3,
            max_bucket=25
        )

        # Build Parent-Child Tree Pointers forming an N-ary Tree Hierarchy
        node1.children.append(node2)
        node2.children.append(node3)
        node3.children.append(node4)
        node4.children.append(node5)
        node5.children.append(node6)

        # Tree Pointers & State Initialization
        self.root = node1
        self.current_node = self.root
        self.current_exp = 0

        # Required EXP milestones to trigger level-up transitions
        self.level_thresholds = {
            1: 300,      # 3 turn-ins required at Lvl 1
            2: 700,      # 4 turn-ins required at Lvl 2
            3: 1400,     # 5 turn-ins required at Lvl 3
            4: 2500,     # 6 turn-ins required at Lvl 4
            5: 4500,     # 7 turn-ins required at Lvl 5
            6: 0         # 0 indicates terminal node / MAX LEVEL cap reached
        }

    @property
    def exp_to_next_level(self):
        """
        Property returning the target EXP threshold for the player's active level rank.

        Returns:
            int or str: Integer threshold if progressing; "MAX" string if at terminal node (Level 6).

        Time Complexity: O(1) constant time dictionary access.
        """
        target = self.level_thresholds.get(self.current_node.level, 0)
        return target if target > 0 else "MAX"

    @property
    def current_level(self):
        """
        Returns the active player level rank from the current node pointer.
        """
        return self.current_node.level if self.current_node else 1

    def get_current_perk_description(self):
        """
        Queries the active `current_node` for the unlocked perk description string.
        """
        if not self.current_node:
            return "Starter Gear (1x1 Tool Range, 5L Water Can)"
        return getattr(self.current_node, 'perk_description', "Starter Gear (1x1 Tool Range, 5L Water Can)")

    def get_current_req(self, season="Spring"):
        """
        Queries the active `current_node` for required crop name and quantity.

        Args:
            season (str, optional): Active season string. Defaults to "Spring".

        Returns:
            tuple: `(crop_name, required_quantity)` tuple.

        Time Complexity: O(1) constant time traversal query.
        """
        return self.current_node.get_required_crop_info(season)

    def get_current_quest_desc(self, season="Spring"):
        """
        Formats and returns the formatted quest description string displayed on the UI quest banner.

        Args:
            season (str, optional): Active season string. Defaults to "Spring".

        Returns:
            str: Formatted quest banner string including quest type, required crops, 
                EXP rewards, and base gold rewards.

        Time Complexity: O(1) string formatting.
        """
        crop_name, amount = self.get_current_req(season)
        if self.current_node.level == 6:
            return "Grandmaster Rank Achieved! Realm Fully Restored!"
        return f"[{self.current_node.quest_type}] Bring {amount}x {crop_name} (+{self.current_node.exp_reward} EXP, +{self.current_node.coin_reward} Gold)"

    def get_aoe_range(self):
        """
        Queries the active `current_node` for the player's unlocked tool AOE dimension.

        Returns:
            int: Unlocked tool range dimension (1, 2, or 3).

        Time Complexity: O(1) property access.
        """
        return self.current_node.unlocked_aoe

    def get_max_bucket(self):
        """
        Queries the active `current_node` for the player's unlocked watering can capacity.

        Returns:
            int: Maximum watering bucket capacity in liters.

        Time Complexity: O(1) property access.
        """
        return self.current_node.max_bucket

    def add_exp(self, amount):
        """
        Accumulates EXP points and advances the tree pointer (`self.current_node`) to child node 
        when the rank's EXP threshold is met.

        Args:
            amount (int): EXP points gained from a quest turn-in or action.

        Returns:
            tuple: A tuple `(level_up_occurred, bonus_coins_earned)`:
                - `level_up_occurred` (bool): True if tree pointer advanced to the next node; False otherwise.
                - `bonus_coins_earned` (int): Gold bonus awarded from the new rank node (0 if no level up).

        Time Complexity: O(1) constant time pointer traversal.
        """
        # Guard clause: if at terminal max rank node (Level 6), do not accumulate further level ups
        if self.current_node.level == 6:
            return False, 0

        self.current_exp += amount
        req = self.level_thresholds.get(self.current_node.level, 0)

        # Check if accumulated EXP meets or exceeds threshold and child node exists
        if req > 0 and self.current_exp >= req and len(self.current_node.children) > 0:
            self.current_exp -= req
            # Advance tree pointer to child node (Level progression traversal)
            self.current_node = self.current_node.children[0]
            return True, self.current_node.level_up_bonus
            
        return False, 0