# Knight Duel — Supabase + Vercel

This package contains the integrated Knight Duel build with the updated Online World files. The original combat/game code is retained in `index.html`; the account and cloud-save additions are included in that file.

## Before you deploy

1. Open your Supabase project.
2. Go to **SQL Editor → New query**.
3. Open `supabase/schema.sql`, copy its full contents into the SQL Editor, and run it.
4. In Supabase, open **Authentication → Providers → Email**.
   - For initial testing, you can turn **Confirm email** off so a new account can sign in immediately.
   - If you keep confirmation on, the player must confirm through email before signing in.
5. In **Authentication → URL Configuration**, add your eventual Vercel site URL to the allowed redirect URLs. You can do this after the first deployment.

## Deploy to Vercel

1. Put the contents of this folder at the root of a GitHub repository:
   - `index.html`
   - `world.js` (Online World; must sit next to index.html)
   - `config.js`
   - `vercel.json`
   - `supabase/schema.sql`
2. Import that GitHub repository in Vercel.
3. Choose **Other** as the framework preset. No build command is required; leave the output directory blank/root.
4. After deployment, add the Vercel URL to Supabase's Site URL and Redirect URLs.

## Supabase key safety

`config.js` contains the Supabase project URL and a **publishable** key. A publishable key is intended for browser use; database access must be protected by the Row Level Security policies in `supabase/schema.sql`.

Never put a Supabase `service_role` key, secret key, database password, or account password in `config.js`, HTML, or GitHub.

## What the current build attempts to save

Each character record includes name, gender, class, armor/tabard colors, level, XP, gold, reputation, inventory, equipment, weapon mastery, quests, and progress counters.

The code queues changes and tries to save them to Supabase. If a cloud save fails, it keeps a pending copy in the browser and retries. This pending browser copy is a recovery aid, not a substitute for a confirmed cloud save.

## Online World — 3D town update

The menu has a separate **Enter Online World** button. It opens a third-person 3D town; the original bot, local two-player, and manual WebRTC duel modes remain separate and are not replaced.

Current additions in this package:
- Larger 180 × 180 walkable outdoor map with a central square, market, guild, tavern, houses, training yard, castle exterior/courtyard, Colosseum, and forest outskirts.
- Third-person follow camera. Drag the mouse to orbit the camera and use the scroll wheel to zoom. Movement follows the camera direction.
- NPCs now use separate civilian/guard-style procedural models rather than reusing the player's knight model. Clothing, colors, accessories, and simple movement/idle animations vary by role.
- 16 named NPCs, including villagers, merchants, blacksmith, guild receptionist, guards, innkeeper, trainer, castle guard, Colosseum guard, and announcer.
- Role-based interaction menus. The Colosseum guard has an actual **Enter the Colosseum** action; the arena is walkable and the announcer offers a return-to-town action.
- The Colosseum has ranked 1v1 PvP matchmaking in code (requires its SQL migration and live testing).
- Humans vs Beasts now has a first playable **solo wave-combat prototype**: wolves, boars, spiders, bears, boss waves, creature pursuit/attacks, player health, and F/on-screen attacks. It is not cooperative multiplayer yet and awards no progression.

- Uses Supabase **Realtime** (presence + broadcast on channel `kd-town-1`). No new tables or SQL are needed; Realtime must be enabled on the project (it is by default).
- In local/offline mode (no Supabase) you can still walk the town alone.
- The Colosseum can be entered and explored. Ranked PvP is implemented in code but not live-tested here. Humans vs Beasts is currently a solo prototype; cooperative matchmaking and server-validated rewards are still outstanding.
- Player positions are trusted from clients. That is fine for a social hub, but any gold/XP/reputation reward must be validated server-side before it is added.

## Important current limitations

- The Online World is still an early 3D social hub, **not yet a full MMORPG**. The arena is explorable, but shops, missions, parties, world combat and matchmaking are not yet active.
- The existing online duel is manual copy/paste WebRTC peer-to-peer; it is not server-authoritative multiplayer or matchmaking.
- Inventory, quests, reputation, towns, NPCs, and the wider RPG/world systems are not fully implemented as gameplay systems yet.
- Browser-side progression can be modified by a determined player. True anti-cheat requires server-authoritative reward validation.
- Two devices saving the same character at the same time can overwrite one another; the latest save wins.
- The project has passed a JavaScript syntax check, but it still needs live browser testing with Supabase before being treated as production-ready.

## Recommended test order

1. Run the SQL schema in Supabase.
2. Open the game locally through a local web server (rather than relying on a `file://` URL).
3. Create an account, create a knight, and confirm that the knight appears in the Supabase `characters` table.
4. Play a training-bot match and confirm that XP/gold changes are saved.
5. Refresh, sign out, and sign back in. Confirm that the same character and progress load.
6. Only after those tests pass, deploy to Vercel and test again on the deployed URL.


## Colosseum PvP (ranked rewards)
After `supabase/schema.sql`, run `supabase/pvp_migration.sql` once in the Supabase SQL Editor. Without it PvP duels still play, but no rewards are given. See `UPDATE_NOTES_3D_WORLD.md`.

## Humans vs Beasts combat controls
- Enter the Colosseum and speak to Cassius, then start **Humans vs Beasts**.
- **Aim / target lock:** press `Tab` (or middle mouse) to lock onto the nearest creature. Press again to release. On touch devices use **AIM / LOCK**. The camera and character turn toward the locked target and a marker appears beneath it.
- **Light attack:** `J` / left mouse. **Heavy attack:** `K` / right mouse.
- **Block / parry:** hold `L` or `Shift`. A well-timed block can parry, using the same timing rules as menu PvP.
- **Dodge:** `Space`. **Swap weapon:** `E`. **Feint:** `U`. **Combo finisher:** `F` when the creature is stunned and the prompt window is open.
- Combat now runs through the same `Core` simulation and character pose animation system as menu PvP: weapon-specific light chains and heavy moves, attack wind-ups/hit windows, stamina costs and recovery, block/parry, dodge, stagger, hit reactions, and combo finishers. Creatures use the same combat rules for their attacks; their procedural models also react to attacks.
- Touch devices show equivalent AIM, LIGHT, HEAVY, DODGE, BLOCK, SWAP, FEINT, and COMBO controls.
- Humans vs Beasts remains solo-only. Rewards still use the existing client-side character save flow and are not anti-cheat protected.

## Current playable activities
- **Ranked Colosseum PvP:** automatic ranked 1v1 queue, best of three, using WebRTC and Supabase Realtime for signaling. Run `supabase/pvp_migration.sql` after `schema.sql` for server-confirmed rewards. Direct WebRTC may fail on restrictive networks because no TURN relay is configured.
- **Humans vs Beasts (solo):** eight escalating waves in the Colosseum. Face a creature and use `J` / left-click for a light attack or `K` / right-click for a heavy attack. Defeat all waves to earn gold, XP and reputation. The reward write uses the existing character save flow and is not anti-cheat protected.
- **Guild Escort (solo):** speak to the Guild Receptionist and choose **Travel to forest clearing**. At the marked contract sign, press `E` (or tap the on-screen prompt) and choose a 5-, 8-, or 10-minute route. Protect the cart until it reaches the destination. Rewards use the existing client save flow.
- **Mobile activity controls:** when a solo activity is active on a touch device, use the on-screen combat controls (aim, attacks, dodge, block, weapon swap, feint, and combo). Movement uses the on-screen joystick.

Co-op Humans vs Beasts, shared escort sessions, parties, trading, fully functional shops, and authoritative world simulation are not implemented. The game remains a prototype rather than a production MMORPG; the limitations in this README still apply.

## Automatic 1v1 matchmaking (main menu)

The main menu now includes **Find Match**. It uses Supabase Realtime Presence to pair two different signed-in users, then Supabase Realtime Broadcast to exchange WebRTC offer/answer data. The existing `HostRoom`, `netAttach`, and `Core` combat simulation are reused; combat rules were not changed. The old copy/paste WebRTC option remains available as a fallback.

- No new SQL table or migration is required for the matchmaking queue; it is a transient Supabase Realtime Presence channel.
- The existing Supabase project/configuration and Realtime service must be available, and players must sign in and select a character.
- This is automatic matchmaking/signalling, **not** a dedicated authoritative game server. One player's browser hosts the fight.
- WebRTC currently uses public STUN servers only. Some network combinations may fail without a TURN relay; in that case, retry or use the manual connection fallback.
- Multiplayer must be tested with two separate signed-in accounts/browser sessions on the deployed site. A successful local code/syntax check does not prove live matchmaking works.
