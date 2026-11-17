# Knight Duel — Review Notes and Roadmap

## Current build reviewed

The supplied `index.html` is an integrated version of the original Knight Duel game with an account/character layer added.

- Original combat code, weapon definitions, animation data, arenas, training bot, local 2-player mode, and manual WebRTC duel mode are retained in the integrated file.
- Added UI and logic include account sign-in/registration, character selection/creation, class and color selection, a Supabase client, cloud character records, pending-save recovery, and basic training-bot match rewards.
- A JavaScript syntax check passed.
- No live browser play-test or live Supabase test has been completed as part of this review.

## Stage 1 — Accounts and characters

**Implemented in code; requires live testing**
- Supabase email/password sign-up and sign-in.
- Persistent Supabase sessions.
- Up to five characters per account (enforced by the database trigger).
- Character records include level, XP, gold, reputation, inventory, equipment, weapon mastery, quests, and progress fields.
- Character creator includes name, gender, class, armor color, and tabard color.
- Basic XP, gold, level, weapon-mastery, and win/loss progression from training-bot matches.
- Automatic save queue with retry and a local pending copy when cloud saving fails.

**Not yet fully implemented as gameplay**
- Inventory and equipment gameplay/economy.
- Quest gameplay and reputation progression.
- Faces, hairstyles, hair color, and skin tone.
- Balanced class stat bonuses and class proficiency.
- Server-authoritative rewards and anti-cheat.

## Stage 2 — Kingdom / world

**Implemented in code in this update; requires live browser testing**
- Expanded 180 × 180 outdoor map with central square, market, guild, tavern, residential houses, training yard, castle exterior/courtyard, Colosseum arena, roads, and forest outskirts.
- Third-person 3D follow camera with mouse orbit, scroll-wheel zoom, and camera-relative WASD movement.
- NPCs use role-appropriate civilian or guard models rather than the player knight model. Their clothing colors, accessories, body proportions, and simple walking/idle animations vary.
- 16 named NPCs with roles including villagers, merchants, blacksmith, guild receptionist, innkeeper, town crier, guards, trainer, castle guard, Colosseum guard, and announcer.
- Role-based NPC interaction menus. The Colosseum guard opens the entrance action; the arena is walkable and the announcer offers a return-to-town action.
- Other signed-in players appear via Supabase Realtime presence + broadcast, wearing their character gender, weapon, and colors.

**Not yet implemented as functioning gameplay**
- Purchasable shop inventory, equipment management, and crafting.
- Actual escort/rescue/delivery missions, party management, quest rewards, and world events.
- Combat against NPCs or creatures inside the Online World; training dummies are scenery, not combat targets.
- Colosseum PvP matchmaking is implemented in code (needs live testing). Humans vs Beasts now has a solo wave prototype; co-op remains unfinished.
- Interior rooms for the castle, guild, tavern, and shops; these buildings are currently exterior structures.
- Server-authoritative world movement, rewards, and anti-cheat. Supabase Realtime is a prototype presence/movement layer, not an authoritative MMO server.

## Stage 3 — RPG systems

Not implemented yet:
- Full inventory, equipment, crafting, shops, quests, titles, achievements, and reputation systems.
- Escort/caravan missions and world events.
- Balanced class bonuses and weapon proficiency.

## Stage 4 — PvP and Colosseum

Not implemented yet:
- Open-world and ranked duel systems.
- 2v2, 3v3, and 5v5 Colosseum matchmaking.
- Humans vs Beasts co-op matchmaking, synchronized enemy state, team health/revive mechanics, and server-validated wave rewards. The solo prototype is now implemented.

The existing Colosseum arena is retained as an arena asset/map, but that does not mean the full Colosseum game modes exist yet.

## Stage 5 — Real multiplayer

The current copy/paste WebRTC mode is peer-to-peer and is not a persistent shared world. A real MMORPG will need:
- An authoritative game server running validated combat and world state.
- Server-side validation of rewards, progression, inventory, and missions.
- Persistent world/session services, matchmaking, parties, and chat.
- Database-backed account/character APIs and suitable hosting.

## Important technical limits

- The Supabase schema must be run in the user's Supabase project before cloud character storage can work.
- Cloud saving has not yet been verified against the live project.
- Pending unsaved changes are cached in the browser for recovery; they are not proof that the cloud save succeeded.
- Browser-side rewards can be manipulated. RLS protects player records from other users, but it does not make client-calculated rewards cheat-proof.
- Concurrent saves of the same character from multiple devices use last-save-wins behavior.

## Recommended next step

Run the SQL schema in Supabase, then test account creation, character creation, a training-bot reward, refresh, sign-out, and sign-in before deploying to Vercel.


## Game modes update
- Colosseum PvP 1v1 (best of 3): implemented in code, tested in simulation; needs live testing and `supabase/pvp_migration.sql`.
- Humans vs Beasts: first playable solo wave-combat prototype implemented (creature models/AI, waves, health, melee attack, boss every fifth wave). Cooperative matchmaking and server-validated rewards are not implemented yet.
- Guild escort missions: not implemented yet.

## Latest integrated update (2026-11-17)
- Integrated the latest `index.html`, `world.js`, and `config.js` supplied in the conversation into the complete project package while retaining the existing Supabase schema, PvP migration, and Vercel configuration.
- Updated Online World NPC dialogue so the Colosseum and Guild describe the currently playable solo wave and escort activities accurately.
- Made the forest escort contract sign show a clickable interaction prompt, so touch users can open the contract selector without a physical keyboard.
- Added on-screen Light Attack and Heavy Attack buttons during solo activities on touch devices; keyboard/mouse controls remain available on desktop.
- Verified JavaScript syntax for `world.js` and the inline game script. Live browser, Supabase, and two-account multiplayer tests remain outstanding.


### Combat targeting and PvE parity update — 2026-11-17
- Added target lock and aim camera support for monster fights.
- PvE attacks now call the same combat Core used by menu PvP instead of applying fixed damage immediately.
- Added PvP weapon animations, stamina, block/parry, dodge, weapon swap, feint, stagger, and combo-finisher behavior to solo monster encounters.
- Added matching mobile controls and updated the escort encounter to distinguish player health from cart health.
- Verified JavaScript syntax and a standalone combat-Core hit test. Browser/device testing remains outstanding.
