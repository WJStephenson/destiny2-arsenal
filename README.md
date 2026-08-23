# Destiny 2 Arsenal & Perk Explorer (PWA)

A locally hosted, Progressive Web App (PWA) and high-performance Destiny 2 weapon & armor roll explorer, perk query matrix, and live inventory/loadout management application powered by the Bungie.net Manifest API & OAuth 2.0.

![Destiny 2 Arsenal](public/icons/icon-192.png)

## Mobile & PWA Features

- 📱 **Progressive Web App (PWA) Support**:
  - Installable directly to your Home Screen on **Android, iOS Safari, Steam Deck, iPad, Chrome, and Edge**.
  - Operates in full-screen standalone mode without browser URL bars or browser chrome.
  - Service Worker (`sw.js`) with intelligent offline asset and image caching.
  - Custom high-res Destiny 2 Tricorn icons and splash screens.

- 👆 **Mobile Long-Press Info System**:
  - Long press on any perk, trait, base weapon stat, subclass element, or archetype on mobile to open a smooth **animated bottom sheet** with in-depth mechanics, stat bonuses, and combat tips.
  - Built-in haptic vibration feedback with scroll-safe gesture handling.

- 📲 **One-Thumb Mobile Bottom Navigation**:
  - Fixed ergonomic bottom tab bar on mobile phones for instant switching between Weapons, Armor, Vault, Perks, Comparison, and Wishlists.

- 🛡️ **Live Guardian & Vault Manager (OAuth 2.0)**:
  - View equipped gear and Power levels across Hunter, Titan, and Warlock.
  - **1-Click "⚡ Equip"**: Equip gear on your character in real-time.
  - **Vault Manager**: Browse and transfer items to/from the Vault with one tap.
  - **In-Game Loadout Switcher**: Activate saved in-game loadout sets on demand.

- 🎯 **Advanced Weapon Perk & Trait Finder**:
  - Multi-perk matching with toggleable **AND / OR** logic.
  - Autofill autocomplete dropdown for weapon names, archetypes, and sources.
  - Acquisition source badges (*Raid, Dungeon, Nightfall, Trials, Onslaught, etc.*).

---

## Installing the PWA on Your Devices

### Android & Chrome / Edge
1. Open `http://192.168.1.196:5173` in your browser.
2. Tap the **"Install D2 Arsenal App"** banner at the top, or tap the browser menu (⋮) -> **"Install app"** / **"Add to Home screen"**.

### iPhone / iPad (iOS Safari)
1. Open `http://192.168.1.196:5173` in Safari.
2. Tap the **Share** button `[↑]` in Safari's bottom toolbar.
3. Scroll down and tap **"Add to Home Screen"** `[+]`.

---

## Live LAN Access URLs

- **LAN (Ethernet)**: **`http://192.168.1.196:5173`**
- **LAN (Wi-Fi)**: **`http://192.168.1.195:5173`**
- **Local Machine**: **`http://localhost:5173`**
