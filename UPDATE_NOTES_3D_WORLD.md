# Knight Duel — 3D Online World Update

This update changes the presentation and interactions inside **Online World only**. It does not replace the original training bot, local two-player mode, manual WebRTC 1v1 mode, account system, or Supabase character-saving setup.

## Controls
- WASD: move relative to the camera
- Drag the mouse on the 3D scene: orbit the third-person camera
- Mouse wheel: zoom in/out
- E: interact with a nearby NPC; inside the arena, use the announcer's menu to return
- Escape: leave Online World

## What changed
- Expanded the town bounds to a 180 × 180 walkable outdoor area.
- Added a third-person perspective camera with orbit and zoom.
- Added a training yard and castle exterior/courtyard, in addition to the square, market, guild, tavern, houses, Colosseum, and outskirts.
- Replaced the reused knight NPC models with separate procedural civilian and guard models, with role-based clothing, accessories, varied skin/hair colors, and simple idle/walk animation.
- Added a dedicated Colosseum guard. Its interaction menu has an **Enter the Colosseum** action. The arena floor and spectator seating are explorable, and the announcer offers a **Return to town** option.
- Added role-specific choices for merchants, the guild receptionist, innkeeper, trainer, town guards, villagers, and the Colosseum staff.

## Honest feature status
The shop, mission board, party system, and inn services are not complete gameplay systems yet. Ranked 1v1 PvP is implemented in code but still needs live testing. Humans vs Beasts now has a solo wave-combat prototype; cooperative matchmaking and server-validated rewards are still outstanding.

## Supabase / deployment
- `config.js` is carried over unchanged.
- `supabase/schema.sql` is carried over unchanged; this world update does not require a new SQL migration.
- Supabase Realtime presence and movement broadcast remain the prototype's multiplayer layer. It is not an authoritative MMO server.
- Put `index.html`, `world.js`, `config.js`, `vercel.json`, and the `supabase` folder at the same project root structure shown in the ZIP. Keep `world.js` beside `index.html`.

## Verification
JavaScript syntax checks pass for the updated `world.js` and the existing inline game script. A real browser session with two signed-in accounts is still required to verify the 3D presentation and live Supabase Realtime behavior. This package has not been represented as live-tested.

## Update: map-based town + movement fix
- **Movement fix:** W now walks where the camera looks, S backs away, D/A strafe to the screen right/left at any camera angle (the previous camera-relative formula had the wrong sign, so movement drifted from the facing direction once the camera was rotated).
- **Town layout** now follows the supplied map image: irregular walled town with round towers and three gates (south-west, north, east), a central plaza with fountain and market, a church, dense red-roofed streets, the castle and training yard on the western hill, farm fields, a windmill farm hamlet in the south-west, and the Colosseum on the north-west field beside the north road.
- NPCs keep their names, dialogue, menus and models; only their coordinates changed to fit the new layout.
- Supabase connection, presence and movement-sync code, `config.js`, `schema.sql` and `index.html` are unchanged.
- Verified headlessly: syntax, walkability from the plaza to all gates, the Colosseum, castle yard, church, doors and hamlet, and that no NPC stands inside an obstacle. Not yet seen in a real browser.

## Update: fixed third-person camera + roads
- **Camera:** fixed third-person chase camera behind the knight. Mouse-drag orbit was removed. The mouse wheel only zooms, limited to 5.2–8.6 m so it can never pull far out or drop into a first-person view.
- **Controls:** W/S walk along the direction the knight faces (S backs up slower), A/D turn the knight, and the camera swings round behind it. Touch: joystick up/down walks, left/right turns.
- **Roads:** roads and streets are now smooth curves, wider, with darker edges (dirt roads outside the walls, stone streets inside).

## Update: A/D strafe + photo-style look
- **Controls:** W/S/A/D now all move the knight (forward/back/left/right relative to the fixed camera); the knight turns to face the direction it walks. A/D no longer turn. Wheel zoom stays limited to 5.2–8.6 m.
- **Look (inspired by the supplied street photo):** cobblestone streets and plaza, stone houses with steep slate gable roofs and chimneys, blue doors and windows with flower boxes, ivy, bunting across the streets, café tables with umbrellas, bicycles, a white cat, and warm golden-hour lighting. Layout is unchanged.
- Supabase connection/realtime code, config.js, schema.sql and index.html are unchanged.

## Update: M2 turns the camera
- Hold the **right mouse button (M2)** and drag to rotate the camera (left/right) and tilt it slightly (up/down, limited to a narrow range so it stays third person). The browser context menu is suppressed on the game canvas only while you are in the Online World.
- W/A/S/D always move relative to where the camera looks; the knight faces the way it walks. Wheel zoom stays limited to 5.2–8.6.

## Stage 1 of Game Modes: Colosseum PvP (ranked 1v1, best of 3)
**How to play:** enter the Colosseum (Colosseum Guard NPC), talk to the Announcer, choose **Register for a PvP duel**. Stay in the arena (the waiting area; a panel shows the queue). When another registered player is found, the announcer calls the match, both knights are connected automatically, and you fight with the normal Knight Duel combat. First to 2 rounds wins. A results screen shows the outcome; **Return to town** puts you outside the arena gate.

**What it reuses (nothing rewritten):** the existing duel engine (`HostRoom` / `NetView` / `netAttach`) over WebRTC. The only difference from the manual mode is that the connection codes are exchanged automatically through Supabase Realtime. The manual copy/paste "Play Online" mode is untouched.

**Rewards (server-side):** run `supabase/pvp_migration.sql` once in the Supabase SQL Editor (after `schema.sql`). It adds one table (`pvp_reports`) and one function (`pvp_report`); existing tables are not changed. A reward is paid only when both players report the same winner, once per character per match, with caps (12 rewarded matches/hour, 4 per opponent/day). Winner: +50 gold, +60 XP, +8 reputation. Loser: +10 gold, +20 XP. Wins/losses are stored in the character's `progress` (`pvpW`, `pvpL`); "My PvP record" shows them. Without the migration the game says rewards are not enabled and gives none.

**What works (tested in simulation, not on live servers):** queueing and automatic pairing (never the same account), host/guest roles, automatic connection, best-of-3 stop, surrender handling, dual result reporting, duplicate/capped/disputed/missing-migration messages, return to town, no rewards when the opponent disconnects.

**Known limits (honest):**
- Not tested against your live Supabase/WebRTC yet. The SQL was reviewed by hand but not executed here.
- Direct WebRTC uses STUN only; a few networks block it. The game then says it could not connect (no relay fallback yet).
- Two colluding accounts can trade wins up to the caps. The `characters` table still lets a player edit their own row directly (the existing save mechanism), so fully tamper-proof rewards need a separate hardening migration.
- No level/skill-based matching, no rating, no spectators yet. A player who simply closes the tab mid-match gets no penalty.

## Stage 2 of Game Modes: Humans vs Beasts (solo gameplay prototype)
- The Colosseum Announcer now offers **Start Humans vs Beasts**.
- The first playable wave-combat prototype includes procedural 3D wolves, boars, spiders, bears, and a larger boss creature every fifth wave.
- Creatures pursue the player, attack at close range, and have different health, speed, and damage values.
- The player has a health bar and can attack with **F** (or the on-screen ATTACK button on touch screens). Move with WASD and stay inside the arena.
- Waves grow in size and enemy toughness. The activity ends when the player's health reaches zero; the results screen reports the wave reached and beasts defeated.
- This is currently a **solo prototype**. Cooperative matchmaking, shared enemy state, party health/revive mechanics, and server-confirmed gold/XP/reputation rewards are not implemented yet. No character progression is awarded by this prototype.

## Not built yet (next stages, in your recommended order)
- Humans vs Beasts cooperative matchmaking and server-validated wave rewards.
- Guild escort missions (routes, caravan, encounters, mission rewards). The guild receptionist still says contracts are not posted.


## Latest gameplay usability fixes (2026-11-17)
- Updated Guild Receptionist, Colosseum Guard, and Announcer dialogue to describe the available solo escort and Humans vs Beasts activities accurately.
- The forest contract sign now exposes a clickable on-screen prompt when the player is close enough. This allows touch users to open the contract selector without pressing E.
- During solo wave and escort activities on touch devices, the activity HUD includes Light Attack and Heavy Attack buttons. Desktop J/K and mouse controls are unchanged.
- These changes do not add co-op matchmaking or server-authoritative PvE rewards.
