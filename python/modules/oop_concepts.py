# python/modules/oop_concepts.py

class Crop:
    """
    Represents a specific agricultural crop template within the farming simulator.
    
    This class serves as the Object-Oriented Programming (OOP) blueprint for all plantable
    crops in the game. It encapsulates crop-specific metadata including growth duration,
    market value, seasonal viability, and rarity tier.
    
    Attributes:
        name (str): The display name of the crop (e.g., "Parsnip", "Cauliflower").
        symbol (str): Single-character string representation used as a visual shorthand or ASCII fallback.
        days_to_grow (int): Number of consecutive watered days required for the crop to reach full maturity.
        sell_price (int): Monetary value (in coins) awarded to the player upon harvesting and selling the crop.
        season (str): The specific season ("Spring", "Summer", "Fall", "Winter") during which the crop can grow without wilting.
        rarity (str): Classification tier ("Common", "Uncommon", "Rare") affecting drop rates in mystery seed bags.
    """
    def __init__(self, name, symbol, days_to_grow, sell_price, season, rarity):
        """
        Initializes a new Crop template instance with physical and economic properties.

        Args:
            name (str): Display name of the crop.
            symbol (str): Visual icon/character representation.
            days_to_grow (int): Total growth stages required before harvest.
            sell_price (int): Gold coin value when sold.
            season (str): Compatible growth season.
            rarity (str): Rarity classification tier.
        """
        self.name = name
        self.symbol = symbol
        self.days_to_grow = days_to_grow
        self.sell_price = sell_price
        self.season = season
        self.rarity = rarity

# Global lookup dictionary mapping crop key names (str) to their instantiated Crop object templates.
# Acts as an O(1) constant-time Hash Table registry for seeding, purchasing, and harvesting operations.
CROP_DATABASE = {
    "Parsnip": Crop("Parsnip", "P", 3, 35, "Spring", "Common"),
    "Cauliflower": Crop("Cauliflower", "C", 5, 70, "Spring", "Uncommon"),
    "Strawberry": Crop("Strawberry", "S", 7, 100, "Spring", "Rare"),
    "Tomato": Crop("Tomato", "T", 3, 40, "Summer", "Common"),
    "Corn": Crop("Corn", "C", 5, 80, "Summer", "Uncommon"),
    "Melon": Crop("Melon", "M", 7, 120, "Summer", "Rare"),
    "Yam": Crop("Yam", "Y", 3, 45, "Fall", "Common"),
    "Pumpkin": Crop("Pumpkin", "P", 5, 80, "Fall", "Uncommon"),
    "Grape": Crop("Grape", "G", 7, 125, "Fall", "Rare"),
    "Powdermelon": Crop("Powdermelon", "W", 7, 200, "Winter", "Rare")
}