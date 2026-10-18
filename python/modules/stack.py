# python/modules/stack.py

class ActionStack:
    """
    Data Structure: Last-In, First-Out (LIFO) Stack
    -----------------------------------------------
    Manages the action history log and tile-clearing mechanisms for the garden simulator.
    
    Role in Game Mechanics:
    1. Action Recording (Push): Appends player actions (till, water, plant, fertilize, harvest)
       onto the top of the stack as structured dictionaries.
    2. Header Banner Display (Peek): Inspects the top item without mutating the stack to display
       the most recent player action on the garden UI banner.
    3. Shovel Tile Clearing (Looping Pop): Executes a targeted traversal that pops and removes
       all historical action records associated with a specific tile (r, c) until its history
       is cleared, returning the tile to its default raw state.
    """
    def __init__(self):
        """Initializes an empty LIFO stack using Python's built-in dynamic list."""
        self._stack = []

    def push(self, action_data):
        """
        Pushes a new action event record onto the top of the stack.
        
        Args:
            action_data (dict): Record containing action metadata 
                                (e.g., {'action': 'till', 'r': 0, 'c': 0, 'desc': 'Tilled Soil at [0, 0]'}).
        
        Time Complexity: O(1) amortized.
        """
        self._stack.append(action_data)

    def pop(self):
        """
        Removes and returns the most recent action record from the top of the stack.
        
        Returns:
            dict or None: The top action record if the stack is non-empty; otherwise None.
            
        Time Complexity: O(1).
        """
        return self._stack.pop() if self._stack else None

    def peek(self):
        """
        Inspects and returns the most recent action record from the top of the stack
        without removing it.
        
        Returns:
            dict or None: The top action record if the stack is non-empty; otherwise None.
            
        Time Complexity: O(1).
        """
        return self._stack[-1] if self._stack else None

    def pop_tile_actions(self, r, c):
        """
        Executes a targeted looping pop traversal through the stack.
        
        Iteratively removes all action records belonging to tile (r, c) while preserving
        the relative LIFO order of action records for all other grid tiles.
        
        Args:
            r (int): Grid row coordinate.
            c (int): Grid column coordinate.
            
        Returns:
            int: Total count of action records popped for tile (r, c).
            
        Time Complexity: O(N) where N is the current size of the stack.
        """
        popped_count = 0
        temp_stack = []

        # Step 1: Pop elements LIFO to extract matching tile actions
        while self._stack:
            top_action = self._stack.pop()
            if isinstance(top_action, dict) and top_action.get('r') == r and top_action.get('c') == c:
                popped_count += 1
            else:
                temp_stack.append(top_action)

        # Step 2: Restore non-matching tile actions back onto the main stack
        while temp_stack:
            self._stack.append(temp_stack.pop())

        return popped_count

    def get_banner_text(self):
        """
        Formats the current top stack record into a readable string for the header banner above the grid.
        
        Returns:
            str: Description of the latest action, or "Field Ready" if the stack is empty.
            
        Time Complexity: O(1).
        """
        top = self.peek()
        if not top:
            return "Field Ready"
        if isinstance(top, dict):
            return top.get('desc', 'Recent Action')
        return str(top)

    def is_empty(self):
        """
        Checks whether the action stack contains any elements.
        
        Returns:
            bool: True if the stack is empty, False otherwise.
            
        Time Complexity: O(1).
        """
        return len(self._stack) == 0

    def clear(self):
        """
        Flushes all historical action records from the stack.
        
        Time Complexity: O(1).
        """
        self._stack.clear()