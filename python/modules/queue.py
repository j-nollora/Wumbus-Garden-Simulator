# python/modules/queue.py
import random

class EnvironmentQueue:
    """
    Data Structure: First-In, First-Out (FIFO) Queue / Circular State Engine
    ------------------------------------------------------------------------
    Manages global macro-environmental progression, daily weather shifts,
    and probabilistic disaster event generation.

    Role in Game Mechanics:
    1. Seasonal Progression (FIFO/Circular Array): Cycles sequentially through 
       Spring -> Summer -> Fall -> Winter every 30 in-game days.
    2. Weather Generation: Executes daily probabilistic rolls (70% Sunny, 30% Rainy)
       and applies auto-hydration pre-passes across tilled soil on rainy days.
    3. Disaster Event Engine: Generates overnight probabilistic disaster events (35% chance)
       and passes event parameters to SoilMatrixGrid for spatial execution.
    """

    def __init__(self):
        """Initializes seasonal calendar pointers, weather states, and disaster pools."""
        # Ordered list of seasons forming a circular sequence
        self.seasons = ["Spring", "Summer", "Fall", "Winter"]

        # Pointer tracking active index in self.seasons
        self.current_season_idx = 0

        # In-game day counter (1 to 30 per season)
        self.current_day = 1

        # Active atmospheric weather state
        self.current_weather = "Sunny"
        
        # Event pool for overnight environmental hazards
        self.disaster_pool = [
            "Meteorite Strike",
            "Alien Escape",
            "Green Rain Windstorm",
            "Earthquake"
        ]

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

    def roll_weather(self):
        """
        Calculates tomorrow's atmospheric state using weighted probability.

        Returns:
            str: "Rainy" (30% probability) or "Sunny" (70% probability).
            
        Time Complexity: O(1).
        """
        return "Rainy" if random.random() < 0.30 else "Sunny"

    def roll_disaster(self):
        """
        Determines if an overnight disaster event occurs.

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
        
        1. Calendar Increment: Increments current_day; shifts season index via FIFO/modular arithmetic 
           when day exceeds 30.
        2. Weather Roll: Updates current_weather state.
        3. Rain Hydration Pre-pass: Automatically sets is_watered = True for all tilled tiles 
           if current_weather is "Rainy".
        4. Event Generation & Delegation: Rolls overnight disaster event and delegates tile mutations 
           to grid_matrix.process_day_transition().

        Args:
            grid_matrix (SoilMatrixGrid): Reference to the 2D matrix grid board instance.

        Time Complexity: O(R * C) where R and C are rows and columns of the grid.
        """
        # Step 1: Calendar Advancement
        self.current_day += 1
        if self.current_day > 30:
            self.current_day = 1
            self.current_season_idx = (self.current_season_idx + 1) % len(self.seasons)

        # Step 2: Daily Weather Roll
        self.current_weather = self.roll_weather()
        today_season = self.get_current_season()

        # Step 3: Rain Hydration Pre-pass across Matrix Array
        if grid_matrix and self.current_weather.lower() == "rainy":
            for row in grid_matrix.grid:
                for tile in row:
                    if tile.is_tilled:
                        tile.is_watered = True

        # Step 4: Disaster Event Generation
        disaster_event = self.roll_disaster()

        # Step 5: Delegate spatial mutations to SoilMatrixGrid
        if grid_matrix:
            grid_matrix.process_day_transition(today_season, self.current_weather, disaster_event)