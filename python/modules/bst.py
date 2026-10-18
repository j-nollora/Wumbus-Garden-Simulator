# python/modules/bst.py
"""
Binary Search Tree (BST) Environmental Disaster Forecast Module
================================================================
Implements a 30-day seasonal forecast timeline structured as a Binary Search Tree.

Data Structure Mechanics:
-------------------------
- BST Node Key: In-game calendar Day Number (integer 1 through 30).
- Balanced Insertion: Built using mid-point recursive tree balancing on Day 1 
  of each season to maintain O(log N) operations.
- Operations:
  1. O(log N) Exact Day Lookup: `search_day(day)`
  2. O(log N + K) Range Search: `get_upcoming_disasters(current_day, lookahead_days)`
  3. In-Order Traversal: `get_full_season_forecast()` to return Day 1..30 in sorted order.
"""

import random


class ForecastNode:
    """
    Individual Node component forming the 30-Day Forecast Binary Search Tree.

    Attributes:
        day (int): BST Search Key representing the seasonal day number (1 to 30).
        weather (str): Today's active weather ("Sunny" or "Rainy").
        disaster (str or None): Name of the overnight hazard (e.g., "Meteorite Strike"), or None.
        left (ForecastNode or None): Pointer to left child subtree (earlier days).
        right (ForecastNode or None): Pointer to right child subtree (later days).
    """

    def __init__(self, day, weather="Sunny", disaster=None):
        self.day = day
        self.weather = weather
        self.disaster = disaster
        self.left = None
        self.right = None

    def to_dict(self):
        """Serializes node data for WebAssembly / JS frontend rendering."""
        return {
            "day": self.day,
            "weather": self.weather,
            "disaster": self.disaster,
            "has_disaster": self.disaster is not None
        }


class DisasterForecastBST:
    """
    Binary Search Tree Controller for 30-Day Seasonal Environmental Predictions.
    
    Attributes:
        root (ForecastNode or None): Root node of the 30-day balanced BST.
    """

    def __init__(self):
        self.root = None

    def insert(self, day, weather="Sunny", disaster=None):
        """
        Inserts a day node into the BST indexed by day number.
        
        Time Complexity: O(log N) on a balanced tree.
        """
        self.root = self._insert_rec(self.root, day, weather, disaster)

    def _insert_rec(self, node, day, weather, disaster):
        if not node:
            return ForecastNode(day, weather, disaster)
        if day < node.day:
            node.left = self._insert_rec(node.left, day, weather, disaster)
        elif day > node.day:
            node.right = self._insert_rec(node.right, day, weather, disaster)
        return node

    def search_day(self, day):
        """
        Retrieves forecast node for a specific day key in O(log N) time.
        
        Args:
            day (int): Day number (1 to 30).
            
        Returns:
            ForecastNode or None
        """
        return self._search_rec(self.root, day)

    def _search_rec(self, node, day):
        if not node or node.day == day:
            return node
        if day < node.day:
            return self._search_rec(node.left, day)
        return self._search_rec(node.right, day)

    def generate_balanced_season(self, disaster_pool):
        """
        Populates a balanced 30-day BST schedule on Day 1 of a season.
        
        Uses recursive binary midpoint splitting (Day 15 -> Day 7, 22 -> etc.) 
        to ensure the tree remains perfectly balanced with height ~4.
        
        Time Complexity: O(N log N) where N = 30 days.
        """
        self.root = None
        days_array = list(range(1, 31))

        # Generate random environmental conditions for 30 days
        schedule_data = []
        for day in days_array:
            weather = "Rainy" if random.random() < 0.30 else "Sunny"
            disaster = random.choice(disaster_pool) if random.random() < 0.35 else None
            schedule_data.append((day, weather, disaster))

        # Recursive helper to insert midpoints for optimal tree balance
        def build_balanced(items):
            if not items:
                return
            mid = len(items) // 2
            day, weather, disaster = items[mid]
            self.insert(day, weather, disaster)
            build_balanced(items[:mid])
            build_balanced(items[mid + 1:])

        build_balanced(schedule_data)

    def get_upcoming_disasters(self, current_day, lookahead_days=1):
        """
        Executes an O(log N + K) BST Range Query to identify threats coming up 
        between [current_day, current_day + lookahead_days].
        """
        tomorrow = current_day + 1
        results = []
        self._range_query_rec(self.root, tomorrow, tomorrow, results)
        import json
        return json.dumps(results)

    def _range_query_rec(self, node, start_day, end_day, results):
        if not node:
            return
        # Prune left subtree if current node is smaller than range
        if start_day < node.day:
            self._range_query_rec(node.left, start_day, end_day, results)
        # Process node if within range
        if start_day <= node.day <= end_day:
            hazard_name = node.disaster
            if hazard_name:
                results.append({
                    "day": node.day,
                    "disaster": hazard_name,
                    "weather": node.weather
                })
        # Prune right subtree if current node is larger than range
        if end_day > node.day:
            self._range_query_rec(node.right, start_day, end_day, results)

    def get_full_season_forecast(self):
        """
        Performs an In-Order Traversal (Left -> Root -> Right) to return all 30 days 
        sorted chronologically from Day 1 to Day 30 in JSON format.
        """
        results = []
        self._in_order_rec(self.root, results)
        import json
        return json.dumps(results)

    def _in_order_rec(self, node, results):
        if not node:
            return
        self._in_order_rec(node.left, results)
        results.append(node.to_dict())
        self._in_order_rec(node.right, results)