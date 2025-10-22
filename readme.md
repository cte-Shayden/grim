# The Chronicles of Grim Greaser — Mini Undertale-like Demo

This repository contains a tiny browser demo inspired by Undertale / Deltarune using the story characters and scenes you provided (Grim, Zoey, Zack, Mia, Bandit, and several encounters).

What is included
- index.html — main HTML file with a canvas and UI.
- style.css — basic styling and pixel-inspired UI.
- game.js — core game logic: simple state machine (menu → intro/story → exploration → battle), small bullet-dodge "attack" phase, actions: FIGHT / ACT / ITEM / MERCY, and basic dialogue.
- README.md — this file.

How to run
1. Open `index.html` in a modern browser (Chrome, Firefox, Edge).
2. Click "Start" to play.
3. Use the UI buttons to proceed through the story and to choose actions in battle.
4. During enemy attack phases, use arrow keys or WASD to move the "soul" (heart) and dodge projectiles.

Notes and limitations
- This is a lightweight, single-file demo, intentionally small to be easy to extend.
- The game mechanics are inspired by Undertale/Deltarune but simplified (turn-based actions + small dodge segment).
- No external assets are required. Everything is drawn on a canvas and uses a small HTML UI.

Ideas for improvements (if you want to expand)
- Add real sprites / pixel art for Grim, Mia, and enemies.
- Make richer ACT interactions with unique outcomes per enemy.
- Add an inventory, shop, or leveling system.
- Add sound effects and music (WebAudio / <audio>).
- Replace the demo 'bullets' with more interesting attack patterns per enemy.

If you'd like, I can:
- Turn this into a multi-scene web build with better graphics.
- Add save/load using localStorage.
- Implement an expanded dialogue engine using the full story text you provided.

Enjoy — and tell me how you'd like to expand or tweak the demo!
