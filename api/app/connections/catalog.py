"""Connectable-app catalog — what the customer sees on the "חיבורים" screen.

Most apps are powered by Composio (the breadth layer) and hidden behind the
Easy Life brand. A few are `native` (our own connectors): WhatsApp is our
flagship (Meta Cloud API / Evolution) because Composio isn't trusted for
real-time inbound; store/invoicing are our direct integrations.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class App:
    slug: str  # our internal id + channels.kind
    name_he: str
    category: str  # social | messaging | email | store | finance | productivity
    provider: str  # "composio" | "native"
    toolkit: str | None = None  # Composio toolkit slug (when provider=composio)
    icon: str = "plug"  # lucide icon hint for the UI
    note_he: str | None = None


CATEGORIES_HE = {
    "messaging": "הודעות",
    "social": "רשתות חברתיות",
    "email": "דוא\"ל ולוח שנה",
    "store": "חנות ומכירות",
    "finance": "פיננסים",
    "productivity": "כלי עבודה",
}

CATALOG: list[App] = [
    # --- messaging (flagship = native) ---
    App("whatsapp", "וואטסאפ", "messaging", "native", icon="message-circle",
        note_he="הסוכן המרכזי — חיבור דרך מספר העסק שלך"),
    App("instagram", "אינסטגרם", "social", "composio", toolkit="instagram", icon="instagram",
        note_he="הודעות ותגובות"),
    App("facebook", "פייסבוק", "social", "composio", toolkit="facebook", icon="facebook",
        note_he="Messenger ועמודים"),
    App("tiktok", "טיקטוק", "social", "composio", toolkit="tiktok", icon="music",
        note_he="תוכן ותגובות"),
    # --- email / calendar ---
    App("gmail", "Gmail", "email", "composio", toolkit="gmail", icon="mail"),
    App("google_calendar", "יומן Google", "email", "composio", toolkit="googlecalendar", icon="calendar"),
    App("google_drive", "Google Drive", "productivity", "composio", toolkit="googledrive", icon="hard-drive"),
    App("outlook", "Outlook", "email", "composio", toolkit="outlook", icon="mail"),
    App("slack", "Slack", "productivity", "composio", toolkit="slack", icon="slack"),
    # --- store ---
    App("shopify", "Shopify", "store", "composio", toolkit="shopify", icon="shopping-bag"),
    App("woocommerce", "WooCommerce", "store", "native", icon="shopping-cart",
        note_he="חיבור ישיר עם מפתח החנות שלך"),
    # --- finance ---
    App("greeninvoice", "חשבונית ירוקה", "finance", "native", icon="receipt",
        note_he="הכנסות וחשבוניות לתזרים"),
    App("grow", "Grow (משולם)", "finance", "native", icon="credit-card",
        note_he="סליקה ותשלומים"),
    App("quickbooks", "QuickBooks", "finance", "composio", toolkit="quickbooks", icon="calculator"),
]

BY_SLUG = {a.slug: a for a in CATALOG}
