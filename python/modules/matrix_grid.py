# python/modules/matrix_grid.py
"""
Matrix Grid & Garden Board State Module
======================================
This module defines the foundational 2D grid matrix data structures for the garden simulator.

Data Structures & OOP Architecture:
-----------------------------------
1. SoilTile (State Container Node):
   - Represents an individual grid cell storing spatial coordinates (r, c), soil hydration,
     tilling flags, active Crop references, growth progress, HP, and fertilizer defense shields.

2. SoilMatrixGrid (2D Spatial Matrix Grid):
   - A 5x5 2D Array / Matrix data structure `grid[r][c]` holding `SoilTile` objects.
   - Handles spatial calculations, tool execution (till, water, plant, harvest, shovel clear),
     resource tracking (watering can bucket capacity), and day-transition algorithms.
"""

import random

class SoilTile:
    """
    State Container Node for Individual Garden Board Tiles.
    
    Acts as an Object-Oriented state container managing spatial properties, 
    soil states (tilled/watered/wilted), crop growth progression, fertilizer 
    defense shields, and crop health points (HP).
    
    Attributes:
        r (int): Grid row coordinate index (0-indexed).
        c (int): Grid column coordinate index (0-indexed).
        is_tilled (bool): Flag indicating whether the soil has been prepared by a Hoe.
        is_watered (bool): Flag indicating whether the soil is hydrated for the current day.
        is_wilted (bool): Flag indicating whether the crop has withered due to neglect, 
            seasonal incompatibility, or catastrophic disasters.
        is_fertilized (bool): Flag indicating whether a protective defense shield is active.
        hp (int): Current health points of the crop on this tile (0 to 100 HP).
        max_hp (int): Maximum health point capacity (100 HP).
        crop (Crop or None): Blueprint reference to the active Crop object instance.
        growth_stage (int): Day counter tracking crop growth progress.
    """

    def __init__(self, r, c):
        """
        Initializes a new SoilTile at matrix position (r, c) in default raw soil state.
        
        Args:
            r (int): Row position index on the 2D matrix grid.
            c (int): Column position index on the 2D matrix grid.
            
        Time Complexity: O(1) constant time initialization.
        """
        self.r = r
        self.c = c
        self.is_tilled = False
        self.is_watered = False
        self.is_wilted = False
        self.is_fertilized = False
        self.hp = 100
        self.max_hp = 100
        self.crop = None
        self.growth_stage = 0

    def till(self):
        """
        Tills raw soil into farmable soil.
        
        Returns:
            bool: True if raw dirt was successfully tilled; False if already tilled.
            
        Time Complexity: O(1) constant time operation.
        """
        if not self.is_tilled:
            self.is_tilled = True
            return True
        return False

    def water(self):
        """
        Hydrates tilled soil for the active day.
        
        Returns:
            bool: True if tilled soil was successfully hydrated; False if untilled or already watered.
            
        Time Complexity: O(1) constant time operation.
        """
        if self.is_tilled and not self.is_watered:
            self.is_watered = True
            return True
        return False

    def plant(self, crop):
        """
        Plants a seed onto tilled soil that currently has no existing crops.
        
        Args:
            crop (Crop): Active Crop blueprint instance selected from CROP_DATABASE.
            
        Returns:
            bool: True if planting succeeded; False if tile is untilled or already occupied.
            
        Time Complexity: O(1) constant time object binding.
        """
        if self.is_tilled and not self.crop:
            self.crop = crop
            self.growth_stage = 0
            self.is_wilted = False
            self.is_fertilized = False
            self.hp = 100
            self.max_hp = 100
            return True
        return False
    
    def to_dict(self):
        """
        Serializes tile state attributes into a JSON-compatible Python dictionary.
        
        Used for WebAssembly (Pyodide) -> JavaScript DOM synchronization to render 
        the interactive UI and crop growth visuals in real-time.
        
        Returns:
            dict: Structured dictionary containing coordinates, stage indices, HP, and flags.
            
        Time Complexity: O(1) dictionary construction.
        """
        crop_data = None
        if self.crop:
            crop_data = {
                "name": self.crop.name,
                "stage": self.growth_stage,
                "max_stage": getattr(self.crop, "days_to_grow", 3),
                "stage_images": getattr(self.crop, "stage_images", []),
                "icon": getattr(self.crop, "item_icon", None)
            }

        return {
            "r": self.r,
            "c": self.c,
            "tilled": self.is_tilled,
            "watered": self.is_watered,
            "wilted": self.is_wilted,
            "fertilized": self.is_fertilized,
            "has_crop": self.crop is not None,
            "symbol": self.crop.symbol if self.crop else None,
            "name": self.crop.name if self.crop else None,
            "stage": self.growth_stage if self.crop else 0,
            "max_stage": getattr(self.crop, "days_to_grow", 3) if self.crop else 3,
            "hp": self.hp if self.crop else 0,
            "max_hp": self.max_hp if self.crop else 100,
            "crop_data": crop_data
        }


class SoilMatrixGrid:
    """
    2D Matrix Grid Spatial Board & Environment State Controller.
    ----------------------------------------------------------
    Manages the primary 2D grid matrix of `SoilTile` objects. Controls tool interactions,
    water bucket resource levels, crop harvesting logic, shovel clear stack unwinding, 
    and overnight simulation transitions.
    
    Attributes:
        rows (int): Total row capacity (5 rows).
        cols (int): Total column capacity (5 columns).
        grid (list of list of SoilTile): 2D spatial matrix storing SoilTile references.
        bucket_level (int): Remaining capacity of the watering can in liters (0 to 5L).
        disaster_occurred (bool): Flag tracking if an overnight disaster event struck.
        last_disaster_name (str or None): Label of the most recent environmental disaster.
    """

    def __init__(self, rows=5, cols=5):
        """
        Initializes a 2D matrix grid of size (rows x cols) populated with SoilTile instances.
        
        Args:
            rows (int, optional): Number of grid rows. Defaults to 5.
            cols (int, optional): Number of grid columns. Defaults to 5.
            
        Time Complexity: O(R * C) where R is rows and C is columns.
        """
        self.rows = rows
        self.cols = cols
        # 2D Array Matrix List Comprehension
        self.grid = [[SoilTile(r, c) for c in range(cols)] for r in range(rows)]
        self.bucket_level = 5
        self.disaster_occurred = False
        self.last_disaster_name = None

    def get_tile(self, r, c):
        """
        Retrieves the SoilTile object at coordinate (r, c) with spatial boundary checks.
        
        Args:
            r (int): Target row index.
            c (int): Target column index.
            
        Returns:
            SoilTile or None: Tile instance if within grid bounds; otherwise None.
            
        Time Complexity: O(1) direct array indexing lookups.
        """
        if 0 <= r < self.rows and 0 <= c < self.cols:
            return self.grid[r][c]
        return None

    def till_soil(self, r, c, current_weather="Sunny"):
        """
        Tills the soil at coordinate (r, c). 
        Auto-hydrates the tile immediately if today's weather condition is "Rainy".
        
        Args:
            r (int): Target row coordinate.
            c (int): Target column coordinate.
            current_weather (str, optional): Active weather state. Defaults to "Sunny".
            
        Returns:
            bool: True if tilled successfully; False if out of bounds or already tilled.
            
        Time Complexity: O(1) constant time lookup and mutation.
        """
        tile = self.get_tile(r, c)
        if tile and tile.till():
            if str(current_weather).lower() == "rainy":
                tile.is_watered = True
            return True
        return False
    
    def water_soil(self, r, c):
        """
        Waters tile at (r, c) and deducts 1 Liter from the watering bucket capacity.
        
        Args:
            r (int): Target row coordinate.
            c (int): Target column coordinate.
            
        Returns:
            bool: True if watered successfully; False if bucket is empty or tile cannot be watered.
            
        Time Complexity: O(1) constant time operation.
        """
        if self.bucket_level <= 0:
            return False
        tile = self.get_tile(r, c)
        if tile and tile.water():
            self.bucket_level -= 1
            return True
        return False

    def plant_seed(self, r, c, crop):
        """
        Plants a crop seed onto tilled soil at matrix coordinate (r, c).
        
        Args:
            r (int): Target row coordinate.
            c (int): Target column coordinate.
            crop (Crop): Crop blueprint instance.
            
        Returns:
            bool: True if seed planted successfully; False otherwise.
            
        Time Complexity: O(1) constant time operation.
        """
        tile = self.get_tile(r, c)
        return tile.plant(crop) if tile else False

    def apply_fertilizer(self, r, c):
        """
        Applies a protective fertilizer defense shield to an active crop at coordinate (r, c).
        Shield absorbs incoming environmental disaster damage during day transitions.
        
        Args:
            r (int): Target row coordinate.
            c (int): Target column coordinate.
            
        Returns:
            bool: True if fertilizer applied; False if tile has no crop, is wilted, or already shielded.
            
        Time Complexity: O(1) constant time state toggle.
        """
        tile = self.get_tile(r, c)
        if tile and tile.crop and not tile.is_wilted and not tile.is_fertilized:
            tile.is_fertilized = True
            tile.hp = tile.max_hp
            return True
        return False

    def harvest_crop(self, r, c, current_weather="Sunny"):
        """
        Harvests a mature crop at (r, c) and resets the tile state.

        If currently raining, soil remains watered after harvest; 
        otherwise, moisture clears.

        Args:
            r (int): Row coordinate on the grid board.
            c (int): Column coordinate on the grid board.
            current_weather (str, optional): Active weather condition. Defaults to "Sunny".
            
        Returns:
            Crop or None: The harvested Crop instance if fully grown and healthy; otherwise None.
            
        Time Complexity: O(1) constant time lookups and state resets.
        """
        tile = self.get_tile(r, c)
        if tile and tile.crop and not tile.is_wilted and tile.growth_stage >= tile.crop.days_to_grow:
            harvested_crop = tile.crop
            tile.crop = None
            tile.growth_stage = 0

            # Retain soil hydration if actively raining
            if str(current_weather).lower() == "rainy":
                tile.is_watered = True
            else:
                tile.is_watered = False

            tile.is_fertilized = False
            tile.hp = 100
            return harvested_crop
        return None

    def shovel_clear_tile(self, r, c, action_stack=None):
        """
        Executes a stack-based tile clearance using a LIFO pop traversal on ActionStack.
        Completely clears tile (r, c) back to raw un-tilled dirt state.
        
        Args:
            r (int): Row coordinate.
            c (int): Column coordinate.
            action_stack (ActionStack or None): Reference to the LIFO ActionStack instance.
            
        Returns:
            str or None: Name of removed crop or "tilled soil" if cleared; None if already flat dirt.
            
        Time Complexity: O(N) for action stack pop traversal + O(1) for tile resets.
        """
        tile = self.get_tile(r, c)
        if not tile:
            return None

        # Guard clause: check if tile has anything to clear
        if not (tile.is_tilled or tile.crop is not None or tile.is_watered or tile.is_fertilized or tile.is_wilted):
            return None

        removed_name = tile.crop.name if tile.crop else "tilled soil"

        # Execute LIFO pop sequence on stack.py if ActionStack instance is provided
        if action_stack and hasattr(action_stack, 'pop_tile_actions'):
            action_stack.pop_tile_actions(r, c)

        # Reset tile properties back to default raw state
        tile.crop = None
        tile.growth_stage = 0
        tile.is_tilled = False
        tile.is_watered = False
        tile.is_wilted = False
        tile.is_fertilized = False
        tile.hp = 100
        tile.max_hp = 100

        return removed_name

    def process_day_transition(self, current_season, current_weather="Sunny", disaster_name=None):
        """
        Processes overnight matrix grid state changes during end-of-day transitions.
        
        Iterates across all tiles in the 2D matrix grid O(R * C) to compute:
          1. Season Compatibility: Wilts crops out of season.
          2. Hydration Verification: Wilts crops left unwatered.
          3. Growth Stage Increment: Advances healthy crops by +1 stage.
          4. Disaster Damage Calculations: Calculates disaster damage, absorbs damage 
             via fertilizer shields (-70 damage reduction), and wilts crops dropping to 0 HP.
        
        Args:
            current_season (str): Active season ("Spring", "Summer", "Fall", "Winter").
            current_weather (str): Today's weather condition ("Sunny", "Rainy").
            disaster_name (str or None): Overnight disaster event triggered by EnvironmentQueue.
            
        Time Complexity: O(R * C) where R is 5 rows and C is 5 columns (25 tiles total).
        """
        self.disaster_occurred = disaster_name is not None
        self.last_disaster_name = disaster_name

        # Damage ranges per environmental disaster type
        disaster_specs = {
            "Meteorite Strike": (60, 80),
            "Alien Escape": (45, 65),
            "Green Rain Windstorm": (30, 50),
            "Earthquake": (20, 40)
        }

        min_dmg, max_dmg = disaster_specs.get(disaster_name, (20, 40))

        # 2D Grid Matrix Traversal
        for r in range(self.rows):
            for c in range(self.cols):
                tile = self.grid[r][c]

                if tile.crop and not tile.is_wilted:
                    # Step 1. Season Compatibility Check
                    if str(tile.crop.season).lower() != str(current_season).lower():
                        tile.is_wilted = True
                    # Step 2. Hydration Check
                    elif not tile.is_watered:
                        tile.is_wilted = True
                    else:
                        tile.growth_stage += 1

                    # Step 3. Overnight Disaster Processing
                    if self.disaster_occurred and not tile.is_wilted:
                        raw_damage = random.randint(min_dmg, max_dmg)
                        
                        if tile.is_fertilized:
                            # Defense shield absorbs 70 damage then breaks
                            actual_damage = max(0, raw_damage - 70)
                            tile.is_fertilized = False
                        else:
                            actual_damage = raw_damage

                        tile.hp -= actual_damage
                        if tile.hp <= 0:
                            tile.hp = 0
                            tile.is_wilted = True

                # Clear daily soil moisture on non-rainy days
                if str(current_weather).lower() != "rainy":
                    tile.is_watered = False