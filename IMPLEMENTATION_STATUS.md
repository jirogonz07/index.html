# Knight Duel — current implementation status (2026-11-17)

## Preserved project files and systems
- `index.html`, `world.js`, `config.js`, `vercel.json`, `supabase/schema.sql`, and `supabase/pvp_migration.sql` are included.
- Existing training bot, local 2-player, manual WebRTC 1v1, account/character system, cloud save queue, Online World, and ranked Colosseum code are retained.
- The existing Supabase project URL and publishable key are carried over in `config.js`; no secret/service-role key was added.
- No database tables or migrations were removed or modified.

## Playable systems in this package
- Solo Humans vs Beasts: eight waves with procedural creatures and increasing difficulty.
- Solo Guild Escort: short (5 min), medium (8 min), and long (10 min) routes with a cart, merchant, pursuers, cart health, timer, success/failure, and rewards.
- Ranked Colosseum PvP: 1v1 best-of-three flow with automatic pairing/signaling and server-side result reporting when the existing PvP migration is installed.
- Online World: town exploration, role-specific NPCs, movement, and Supabase Realtime presence prototype.

## Fixes in this update
- Corrected outdated Guild and Colosseum NPC dialogue that incorrectly described available solo activities as future features.
- Added a clickable on-screen interaction prompt at the forest escort sign for touch users.
- Added touch-screen Light Attack and Heavy Attack buttons while solo activities are active. Desktop keyboard/mouse controls remain unchanged.

## Important limitations
- Humans vs Beasts and Guild Escort are solo/local activities, not co-op.
- PvE and escort rewards are client-calculated and use the existing character save flow; they are not duplicate-proof or cheat-resistant.
- Ranked PvP rewards require `supabase/pvp_migration.sql` to be run after `schema.sql`.
- WebRTC uses STUN only; some networks may require a TURN relay that is not configured.
- Supabase, browser rendering, WebRTC, and multiplayer sessions were not end-to-end tested in this environment.
- The game is a playable prototype, not a complete authoritative MMORPG. Shops, parties, trading, co-op PvE, and server-authoritative world simulation remain future work.

## Checks
- `node --check world.js`: passed.
- Extracted inline game script from `index.html` and ran `node --check`: passed.
- ZIP integrity: checked after packaging.


## 2026-11-17 combat and targeting update
- Added target lock for solo monster encounters: `Tab` or middle mouse on desktop, AIM / LOCK on touch. A visible ground marker identifies the locked creature; player facing and camera framing follow the target.
- Replaced the separate fixed-damage PvE attack shortcut with the existing `Core` combat simulation used by menu PvP. Monster encounters now use the selected character weapon's actual PvP move definitions, attack timing, hit windows, stamina, blocking/parry, dodge, feint, weapon swap, stagger, hit reactions, and combo finisher rules.
- Player attack poses use the same existing character animation/pose system as menu PvP. Creature models show attack and hit/stagger reactions.
- Escort pursuers can be fought with the same combat system while the cart continues along its route; cart health and player health are tracked separately.
- Added equivalent touch controls for aim, light/heavy attack, dodge, block, weapon swap, feint, and combo. Kept the controls container stable during HUD updates so touch interactions are not interrupted by per-frame status refreshes.
- No Supabase configuration, schema, migration, account, save, or ranked PvP files were changed.
- Checks: `node --check world.js` passed; extracted inline `index.html` script syntax check passed; isolated PvP Core smoke test passed (light attack generated a hit event). Live browser rendering and end-to-end gameplay still require testing in the user's browser.

## 2026-11-17 — Main-menu automatic 1v1 matchmaking
- Added Find Match / Cancel Search to the main menu.
- Reused Supabase Realtime Presence for pairing and Realtime Broadcast for WebRTC signalling.
- Reused the existing `HostRoom`, `netAttach`, and `Core` combat flow; no combat rules were changed.
- Kept the manual copy/paste WebRTC flow as a fallback.
- This is matchmaking/signalling, not a dedicated authoritative game server. One player's browser hosts the fight.
- Requires live testing with two separate signed-in accounts. STUN-only connectivity may fail on some networks without TURN.
