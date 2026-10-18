# python/modules/queue.py
import random

# Safe import for Pyodide/WASM or standard local execution
try:
    from bst import DisasterForecastBST
except ImportError:
    import sys
    if 'bst' in sys.modules:
        DisasterForecastBST = sys.modules['bst'].DisasterForecastBST
    else:
        DisasterForecastBST = globals().get('DisasterForecastBST', None)


class EnvironmentQueue:
    """
    Data Structure: First-In, First-Out (FIFO) Queue & Disaster Forecast BST Controller
    ---------------------------------------------------------------------------------
    Manages global macro-environmental progression, daily weather shifts,
    and 30-day Binary Search Tree forecast indexing.

    Role in Game Mechanics:
    1. Seasonal Progression (FIFO/Circular Array): Cycles sequentially through 
       Spring -> Summer -> Fall -> Winter every 30 in-game days.
    2. Weather & Disaster Generation (BST Timeline): Queries DisasterForecastBST
       in O(log N) time for daily weather and overnight disaster events.
    3. Forecast Radar Interface: Exposes range queries for 3-day radar warnings
       and in-order traversals for the 30-day modal calendar.
    """

    def __init__(self):
        """Initializes seasonal calendar pointers, weather states, disaster pools, and the forecast BST."""
        # Ordered list of seasons forming a circular sequence
        self.seasons = ["Spring", "Summer", "Fall", "Winter"]

        # Pointer tracking active index in self.seasons
        self.current_season_idx = 0

        # In-game day counter (1 to 30 per season)
        self.current_day = 1

        # Event pool for overnight environmental hazards
        self.disaster_pool = [
            "Meteorite Strike",
            "Alien Escape",
            "Green Rain Windstorm",
            "Earthquake"
        ]

        # Active atmospheric weather state
        self.current_weather = "Sunny"

        # Initialize the 30-Day Disaster Forecast Binary Search Tree
        self.forecast_bst = DisasterForecastBST() if DisasterForecastBST else None
        
        # Populate Day 1 to Day 30 forecast nodes in BST
        self.refresh_season_forecast()

        # Sync initial Day 1 weather state from BST lookup
        if self.forecast_bst:
            day1_node = self.forecast_bst.search_day(1)
            if day1_node:
                self.current_weather = day1_node.weather

    def refresh_season_forecast(self):
        """Re-seeds the 30-day forecast BST with a balanced node hierarchy."""
        if self.forecast_bst:
            self.forecast_bst.generate_balanced_season(self.disaster_pool)

    def get_current_season(self):
        """
        Returns the active season string used for crop compatibility validation.

        Returns:
            str: Name of active season ("Spring", "Summer", "Fall", "Winter").
            
        Time Complexity: O(1).
        """
        return self.seasons[self.current_season_idx]

    def get_current_weather(self):
        """
        Returns today's active weather condition.

        Returns:
            str: "Sunny" or "Rainy".
            
        Time Complexity: O(1).
        """
        return self.current_weather

    def check_upcoming_hazards(self, lookahead_days=3):
        """
        Queries the BST for disasters scheduled within the next N days via O(log N + K) range query.
        """
        if self.forecast_bst:
            raw = self.forecast_bst.get_upcoming_disasters(self.current_day, lookahead_days)
            import json
            return json.loads(raw) if isinstance(raw, str) else raw
        return []

    def get_season_calendar(self):
        """
        Performs an In-Order Traversal on the BST to return all 30 days chronologically.
        """
        if self.forecast_bst:
            raw = self.forecast_bst.get_full_season_forecast()
            import json
            return json.loads(raw) if isinstance(raw, str) else raw
        return []

    def roll_weather(self):
        """
        Calculates atmospheric state using weighted probability (Fallback method).

        Returns:
            str: "Rainy" (30% probability) or "Sunny" (70% probability).
            
        Time Complexity: O(1).
        """
        return "Rainy" if random.random() < 0.30 else "Sunny"

    def roll_disaster(self):
        """
        Determines if an overnight disaster event occurs (Fallback method).

        Returns:
            str or None: Selected disaster name if rolled (35% probability); otherwise None.
            
        Time Complexity: O(1).
        """
        if random.random() < 0.35:
            return random.choice(self.disaster_pool)
        return None

    def advance_day(self, grid_matrix):
        """
        Advances global game time by 1 day and coordinates macro-environment state updates:
        
        1. Calendar Increment: Increments current_day; shifts season index via FIFO/circular 
           arithmetic and re-seeds the BST when day exceeds 30.
        2. Forecast BST Lookup: Retrieves today's pre-calculated weather and overnight disaster 
           from the BST in O(log N) time.
        3. Rain Hydration Pre-pass: Automatically sets is_watered = True for all tilled tiles 
           if today's weather is "Rainy".
        4. Event Delegation: Passes overnight disaster event to SoilMatrixGrid.process_day_transition().

        Args:
            grid_matrix (SoilMatrixGrid): Reference to the 2D matrix grid board instance.

        Time Complexity: O(R * C) where R and C are rows and columns of the grid board.
        """
        # Step 1: Calendar Advancement & Seasonal Rollover
        self.current_day += 1
        if self.current_day > 30:
            self.current_day = 1
            self.current_season_idx = (self.current_season_idx + 1) % len(self.seasons)
            # Re-seed the Binary Search Tree for the new 30-day season
            self.refresh_season_forecast()

        # Step 2: BST Forecast Lookup in O(log N) time
        disaster_event = None
        if self.forecast_bst:
            today_node = self.forecast_bst.search_day(self.current_day)
            if today_node:
                self.current_weather = today_node.weather
                disaster_event = today_node.disaster
            else:
                self.current_weather = self.roll_weather()
                disaster_event = self.roll_disaster()
        else:
            self.current_weather = self.roll_weather()
            disaster_event = self.roll_disaster()

        today_season = self.get_current_season()

        # Step 3: Rain Hydration Pre-pass across Matrix Array
        if grid_matrix and self.current_weather.lower() == "rainy":
            for row in grid_matrix.grid:
                for tile in row:
                    if tile.is_tilled:
                        tile.is_watered = True

        # Step 4: Delegate spatial mutations to SoilMatrixGrid
        if grid_matrix:
            grid_matrix.process_day_transition(today_season, self.current_weather, disaster_event)