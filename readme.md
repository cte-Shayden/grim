# Grim Greaser: Ridgewood — Undertale-like Prototype

This is a small browser prototype inspired by "The Chronicles of Grim Greaser". It's Undertale‑like in that you explore, talk, choose actions (Act/Fight/Mercy/Item), and can resolve encounters without violence.

How to run
- Save the repository files (index.html, style.css, game.js).
- Open `index.html` in a modern browser (Chrome/Firefox).
- Controls:
  - Overworld: Arrow keys to move, Enter to interact / talk.
  - Battle: Left / Right to change selection, Z to confirm, X to cancel.
  - In Fight: Arrow keys (or mouse) to dodge, stay inside the white "heart" and avoid red projectiles.

Design notes
- Scenes: `OverworldScene` (walk + talk), `BattleScene` (turn-based with a dodge minigame).
- Characters are represented with simple colored rectangles so you can prototype quickly.
- Dialogue uses short lines pulled from story themes. Extend `characters` and `acts` in `game.js`.
- Enemy behavior is configurable: add enemies to the enemy list with HP, mood rules, sprites, and Act reactions.

Next steps (ideas)
- Replace placeholder shapes with pixel art/sprites for Grim, Zoey, Zack, Mia, Bandit, enemies.
- Add a small map or tilemap, save/load state.
- Expand Act list (e.g., "Joke", "Remember Parents", "Show Locket") and hook them to story-specific branches.
- Add music and SFX (careful of licensing).
- Implement more battle types (shielded enemies, multi-phase bosses).
- Add accessibility features and keyboard remapping.

If you'd like, I can:
- Add art assets (sprite sheets) and pack them,
- Extend the story branches (e.g., Mia obsession twists into a longer arc),
- Make a simple level editor for dialog + enemy config,
- Create a GitHub branch and push these files (if you give me the repo push permission).

Enjoy! — your prototyping assistant
