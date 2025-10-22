// tiny Undertale/Deltarune inspired demo with sound support
// single-file game logic (updated to load and play sounds from snd/)

(() => {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const startBtn = document.getElementById('start-game');
  const resetBtn = document.getElementById('reset-game');
  const dialogueBox = document.getElementById('dialogue-box');
  const dialogueText = document.getElementById('dialogue-text');
  const nextBtn = document.getElementById('next-btn');
  const stateLabel = document.getElementById('state-label');
  const hud = document.getElementById('hud');
  const battleUI = document.getElementById('battle-ui');
  const actionButtons = document.querySelectorAll('.action');
  const enemyNameLabel = document.getElementById('enemy-name');
  const enemyHPFill = document.getElementById('enemy-hp');
  const playerHPFill = document.getElementById('player-hp');
  const combatLog = document.getElementById('combat-log');

  // --- sound setup ---
  const audioMap = {
    // UI / SFX
    'ui-click': 'snd/mo_pop.ogg',
    'start': 'snd/mail_jingle_alt.ogg',
    'fight-hit': 'snd/mo_pop.ogg',
    'act': 'snd/pinkgoo_move.ogg',
    'item': 'snd/clover_jump_dunes.ogg',
    'mercy-success': 'snd/mail_jingle_alt.ogg',
    'mercy-fail': 'snd/pops_deflate.ogg',
    'enemy-attack': 'snd/wild_east_shocking_sound.ogg',
    'player-hurt': 'snd/wood_zap.ogg',
    'victory': 'snd/microsprings_froggits.ogg',
    'gameover': 'snd/wood_flowey.ogg',
    'doorclose': 'snd/doorclose.ogg',

    // background / ambiances (looped)
    'bg-exploration': 'snd/snowdin_bridge.ogg',
    'bg-battle': 'snd/sandstorm.ogg'
  };

  // baseAudio holds non-cloned audio (use for looped music)
  const baseAudio = {};

  // quick clone-and-play helper for short SFX (allows overlapping)
  function playSfx(name, opts = {}) {
    const url = audioMap[name];
    if (!url) return null;
    try {
      // If we have a base non-looping audio stored, clone it
      const base = baseAudio[name];
      if (base && !base.loop) {
        const node = base.cloneNode();
        node.volume = (opts.volume ?? 0.9);
        node.currentTime = 0;
        node.play().catch(() => {});
        return node;
      }
      // Fallback: create a new Audio each time
      const a = new Audio(url);
      a.preload = 'auto';
      a.volume = (opts.volume ?? 0.9);
      a.play().catch(() => {});
      return a;
    } catch (e) {
      // ignore play errors (autoplay policies, etc.)
      return null;
    }
  }

  // play looped background music (pause any other looped tracks)
  let currentMusic = null;
  function playMusic(name, opts = {}) {
    const url = audioMap[name];
    if (!url) return;

    // if the requested music is already playing, do nothing
    if (currentMusic && currentMusic._name === name && !currentMusic.paused) return;

    // stop previous
    if (currentMusic) {
      try { currentMusic.pause(); } catch (e) {}
    }

    // use a persistent baseAudio entry for music
    let a = baseAudio[name];
    if (!a) {
      a = new Audio(url);
      a.loop = true;
      a.preload = 'auto';
      a.volume = (opts.volume ?? 0.55);
      baseAudio[name] = a;
    }
    a._name = name;
    a.currentTime = opts.startTime || 0;
    a.play().catch(() => {});
    currentMusic = a;
  }

  function stopMusic() {
    if (currentMusic) {
      try { currentMusic.pause(); } catch (e) {}
      currentMusic = null;
    }
  }

  // preload short SFX into baseAudio for faster cloneNode usage
  Object.keys(audioMap).forEach(k => {
    // only preload non-music short SFX into baseAudio
    if (![ 'bg-exploration', 'bg-battle' ].includes(k)) {
      try {
        const a = new Audio(audioMap[k]);
        a.preload = 'auto';
        a.loop = false;
        baseAudio[k] = a;
      } catch (e) { /* ignore */ }
    }
  });

  // --- story & data (abridged and adapted from user-provided content) ---
  const story = {
    intro: [
      "THE CHRONICLES OF GRIM GREASER",
      "In Ridgewood, Grim Greaser lives for mischief, snacks, and shortcuts.",
      "Today something strange stirs in the school...",
      "Zoey, Grim's sister, keeps them grounded. Zack keeps the snacks.",
      "Grim senses a presence: Mia — someone obsessed with him."
    ],
    hallway: [
      "* You walk the halls of Ridgewood High.",
      "* Zoey is organizing papers; Zack is probably near snacks.",
      "Mia: Grim! I made you lunch!",
      "A dark energy flickers... something appears from the shadows!"
    ],
    victoryEnd: [
      "You stood up to the shadows.",
      "The road ahead remains uncertain... TO BE CONTINUED"
    ]
  };

  const encounters = [
    {
      id: 'library-ghost',
      name: 'Library Ghost',
      maxHp: 50,
      hp: 50,
      attack: 10,
      defense: 3,
      exp: 25,
      dialog: ["A ghost drifts from the dusty shelves!"]
    },
    {
      id: 'shadow-wraith',
      name: 'Shadow Wraith',
      maxHp: 80,
      hp: 80,
      attack: 14,
      defense: 6,
      exp: 40,
      dialog: ["A writhing shadow stalks you!", "It feeds on fear..."]
    },
    {
      id: 'mia-boss',
      name: 'Mia',
      maxHp: 140,
      hp: 140,
      attack: 18,
      defense: 8,
      exp: 80,
      dialog: [
        "Mia: You can't avoid me forever, Grim!",
        "Mia: We are meant to be together."
      ]
    }
  ];

  // player state
  const player = {
    maxHp: 100,
    hp: 100,
    level: 1,
    exp: 0
  };

  // game state machine
  let state = 'menu'; // menu | intro | exploration | battleStart | battle | victory | ending | gameover
  let currentDialogue = [];
  let dialogueIndex = 0;
  let currentEncounterIndex = 0;
  let enemy = null;
  let battlePhase = 'menu'; // menu | attackpattern | resolving
  let lastTime = 0;

  // small "soul" dodge area for attack phase
  const soul = { x: canvas.width / 2, y: canvas.height - 140, size: 18, speed: 4, hp: player.hp };
  const keys = {};

  function setState(newState) {
    state = newState;
    stateLabel.textContent = state.toUpperCase();
    // UI toggles
    if (state === 'menu') {
      dialogueBox.classList.add('hidden');
      battleUI.classList.add('hidden');
      stopMusic();
    } else if (state === 'intro' || state === 'exploration' || state === 'victory' || state === 'ending' || state === 'gameover') {
      dialogueBox.classList.remove('hidden');
      battleUI.classList.add('hidden');
      // exploration music whenever we enter exploration/intro/ending
      if (state === 'exploration' || state === 'intro' || state === 'ending') {
        playMusic('bg-exploration', { volume: 0.45 });
      }
    } else if (state === 'battleStart') {
      // show enemy dialog before battle
      dialogueBox.classList.remove('hidden');
      battleUI.classList.add('hidden');
    } else if (state === 'battle') {
      dialogueBox.classList.add('hidden');
      battleUI.classList.remove('hidden');
      playMusic('bg-battle', { volume: 0.45 });
    }
  }

  function startIntro() {
    currentDialogue = [...story.intro];
    dialogueIndex = 0;
    setState('intro');
    updateDialogue();
    playSfx('start', { volume: 0.9 });
  }

  function updateDialogue() {
    if (dialogueIndex < currentDialogue.length) {
      dialogueText.textContent = currentDialogue[dialogueIndex];
    } else {
      // advance from dialogues to next logical state
      if (state === 'intro') {
        // move to exploration/hallway story then battle
        currentDialogue = [...story.hallway];
        dialogueIndex = 0;
        setState('exploration');
        updateDialogue();
      } else if (state === 'exploration') {
        // start first battle
        prepareEncounter(currentEncounterIndex);
      } else if (state === 'battleStart') {
        // enter active battle
        setState('battle');
        startBattleLoop();
      } else if (state === 'victory') {
        // either next encounter or ending
        currentEncounterIndex++;
        if (currentEncounterIndex < encounters.length) {
          // short exploration text then next fight
          currentDialogue = [`After a brief break, another threat looms...`];
          dialogueIndex = 0;
          setState('exploration');
          updateDialogue();
        } else {
          // ending
          currentDialogue = [...story.victoryEnd];
          dialogueIndex = 0;
          setState('ending');
          updateDialogue();
        }
      } else if (state === 'ending') {
        // back to menu
        setState('menu');
      } else if (state === 'gameover') {
        // give player a chance to reset
        setState('menu');
      }
    }
  }

  nextBtn.addEventListener('click', () => {
    playSfx('ui-click', { volume: 0.7 });
    dialogueIndex++;
    updateDialogue();
  });

  startBtn.addEventListener('click', () => {
    playSfx('ui-click', { volume: 0.7 });
    resetAll();
    startIntro();
  });

  resetBtn.addEventListener('click', () => {
    playSfx('doorclose', { volume: 0.7 });
    resetAll();
    setState('menu');
  });

  function prepareEncounter(idx) {
    enemy = JSON.parse(JSON.stringify(encounters[idx]));
    currentDialogue = enemy.dialog.slice();
    dialogueIndex = 0;
    setState('battleStart');
    updateDialogue();
    // update enemy UI when battle begins
    enemyHPFill.style.width = `${(enemy.hp / enemy.maxHp) * 100}%`;
    playerHPFill.style.width = `${(player.hp / player.maxHp) * 100}%`;
    enemyNameLabel.textContent = enemy.name.toUpperCase();
  }

  // action handlers
  actionButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const act = btn.dataset.action;
      if (state !== 'battle' || battlePhase !== 'menu') return;
      playSfx('ui-click', { volume: 0.75 });
      performAction(act);
    });
  });

  function performAction(action) {
    appendCombatLog(`You chose: ${action.toUpperCase()}`);
    if (action === 'fight') {
      playSfx('fight-hit', { volume: 0.85 });
      // instant damage + minor enemy reaction
      const dmg = Math.max(3, Math.floor(Math.random() * 18) + 6 - enemy.defense);
      enemy.hp = Math.max(0, enemy.hp - dmg);
      appendCombatLog(`You strike! ${enemy.name} takes ${dmg} damage.`);
      updateEnemyBar();
      if (enemy.hp <= 0) return onVictory();
      // small delay then enemy attack pattern starts
      setTimeout(() => {
        startEnemyAttack();
      }, 600);
    } else if (action === 'act') {
      playSfx('act', { volume: 0.8 });
      const outcomes = [
        `You told a silly joke. ${enemy.name} hesitates.`,
        `You compliment ${enemy.name}. It seems confused.`,
        `You adjust your green sweatband. It doesn't care.`
      ];
      appendCombatLog(outcomes[Math.floor(Math.random() * outcomes.length)]);
      // start enemy attack after ACT
      setTimeout(startEnemyAttack, 600);
    } else if (action === 'item') {
      playSfx('item', { volume: 0.9 });
      // a small heal item chance
      const heal = 20;
      player.hp = Math.min(player.maxHp, player.hp + heal);
      appendCombatLog(`You ate a snack: +${heal} HP`);
      updatePlayerBar();
      setTimeout(startEnemyAttack, 600);
    } else if (action === 'mercy') {
      playSfx('ui-click', { volume: 0.7 });
      if (enemy.hp < enemy.maxHp * 0.25) {
        playSfx('mercy-success', { volume: 0.9 });
        appendCombatLog(`${enemy.name} accepts mercy and retreats!`);
        onVictory();
      } else {
        playSfx('mercy-fail', { volume: 0.9 });
        appendCombatLog(`${enemy.name} refuses mercy!`);
        setTimeout(startEnemyAttack, 600);
      }
    }
  }

  function onVictory() {
    playSfx('victory', { volume: 0.9 });
    appendCombatLog(`${enemy.name} defeated! You gain ${enemy.exp} EXP.`);
    player.exp += enemy.exp;
    player.hp = Math.min(player.maxHp, player.hp + 12); // small heal on victory
    updatePlayerBar();
    setState('victory');
    currentDialogue = [enemy.name + " fades away..."];  
    dialogueIndex = 0;
    dialogueBox.classList.remove('hidden');
    battleUI.classList.add('hidden');
  }

  function updateEnemyBar() {
    enemyHPFill.style.width = `${(enemy.hp / enemy.maxHp) * 100}%`;
  }
  function updatePlayerBar() {
    playerHPFill.style.width = `${(player.hp / player.maxHp) * 100}%`;
  }

  function appendCombatLog(text) {
    combatLog.classList.remove('hidden');
    const p = document.createElement('div');
    p.textContent = `• ${text}`;
    p.style.fontFamily = '"Press Start 2P", monospace';
    p.style.fontSize = '12px';
    combatLog.appendChild(p);
    combatLog.scrollTop = combatLog.scrollHeight;
  }

  // --- enemy attack patterns and simple bullet dodge ---
  let bullets = [];
  function startEnemyAttack() {
    if (!enemy) return;
    battlePhase = 'attackpattern';
    playSfx('enemy-attack', { volume: 0.9 });
    // spawn bullets for a short homebrew "bullet hell" section
    bullets = [];
    const patternCount = Math.min(12, Math.floor(enemy.attack / 2) + 4);
    for (let i = 0; i < patternCount; i++) {
      const angle = (i / patternCount) * Math.PI * 2;
      const speed = 1.2 + Math.random() * 2 + (enemy.attack / 20);
      bullets.push({
        x: Math.random() * canvas.width,
        y: -10 - Math.random() * 80,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + 0.5,
        r: 8 + Math.random() * 6,
        color: '#ff4d4d'
      });
    }

    // let the attack run for a short while, then resolve
    setTimeout(() => {
      // enemy deals damage based on collisions during attack
      const hits = checkSoulCollisions();
      const dmg = Math.min(player.hp, Math.max(1, Math.floor((enemy.attack / 6) * hits)));
      if (dmg > 0) {
        player.hp = Math.max(0, player.hp - dmg);
        playSfx('player-hurt', { volume: 0.9 });
        appendCombatLog(`${enemy.name} deals ${dmg} damage!`);
        updatePlayerBar();
      } else {
        playSfx('ui-click', { volume: 0.85 });
        appendCombatLog(`You dodged the attack!`);
      }

      bullets = [];
      battlePhase = 'menu';

      if (player.hp <= 0) {
        setTimeout(() => {
          setState('gameover');
          playSfx('gameover', { volume: 0.9 });
          currentDialogue = [
            "You fell down...",
            "But something feels off...",
            "This isn't the end."
          ];
          dialogueIndex = 0;
          dialogueBox.classList.remove('hidden');
          battleUI.classList.add('hidden');
        }, 600);
      }
    }, 1600 + Math.random() * 800);
  }

  function checkSoulCollisions() {
    // count how many bullets intersected the soul while the attack was active
    let hits = 0;
    bullets.forEach(b => {
      const dx = b.x - soul.x;
      const dy = b.y - soul.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < b.r + soul.size) hits++;
    });
    return Math.min(6, hits);
  }

  // --- rendering loop ---
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, '#000011');
    g.addColorStop(1, '#0b0b12');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawScene(time) {
    const dt = (time - lastTime) / 1000;
    lastTime = time;

    // Clear
    drawBackground();

    // If in battle and pattern active, draw enemy and bullets and soul
    if (state === 'battle') {
      // enemy portrait (emoji)
      ctx.fillStyle = '#fff';
      ctx.font = '48px serif';
      ctx.fillText('👻', canvas.width / 2 - 24, 120);

      // bullets
      bullets.forEach(b => {
        b.x += b.vx;
        b.y += b.vy;
        if (b.y > canvas.height + 80 || b.x < -80 || b.x > canvas.width + 80) {
          b.x = Math.random() * canvas.width;
          b.y = -20;
        }
        ctx.beginPath();
        ctx.fillStyle = b.color;
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // draw player's soul (a small heart)
      ctx.save();
      ctx.translate(soul.x, soul.y);
      ctx.fillStyle = '#ff6699';
      drawHeart(ctx, 0, 0, soul.size);
      ctx.restore();
    } else {
      ctx.fillStyle = '#fff';
      ctx.font = '20px "Press Start 2P", monospace';
      if (state === 'intro' || state === 'exploration' || state === 'battleStart' || state === 'victory') {
        ctx.fillText('— Story & Exploration —', 20, 40);
      } else {
        ctx.fillText('Press Start to begin your adventure.', 20, 40);
      }
    }

    if (bullets.length > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '14px monospace';
      ctx.fillText(`Incoming: ${bullets.length}`, 12, canvas.height - 12);
    }

    requestAnimationFrame(drawScene);
  }

  function drawHeart(ctx, x, y, size) {
    const s = size;
    ctx.beginPath();
    ctx.moveTo(x, y + s / 4);
    ctx.bezierCurveTo(x, y - s / 2, x - s, y - s / 2, x - s, y + s / 4);
    ctx.bezierCurveTo(x - s, y + s, x, y + s * 1.4, x, y + s * 1.8);
    ctx.bezierCurveTo(x, y + s * 1.4, x + s, y + s, x + s, y + s / 4);
    ctx.bezierCurveTo(x + s, y - s / 2, x, y - s / 2, x, y + s / 4);
    ctx.fill();
  }

  // soul movement with arrow keys
  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (['arrowleft','arrowright','arrowup','arrowdown'].includes(e.key.toLowerCase())) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });

  function updateSoulPosition() {
    if (state === 'battle' && battlePhase === 'attackpattern') {
      if (keys['arrowleft'] || keys['a']) soul.x -= soul.speed * 2;
      if (keys['arrowright'] || keys['d']) soul.x += soul.speed * 2;
      if (keys['arrowup'] || keys['w']) soul.y -= soul.speed * 2;
      if (keys['arrowdown'] || keys['s']) soul.y += soul.speed * 2;

      const left = 60, right = canvas.width - 60;
      const top = canvas.height - 220, bottom = canvas.height - 60;
      soul.x = Math.max(left, Math.min(right, soul.x));
      soul.y = Math.max(top, Math.min(bottom, soul.y));
    } else {
      soul.x += (canvas.width / 2 - soul.x) * 0.08;
      soul.y += ((canvas.height - 140) - soul.y) * 0.08;
    }
    requestAnimationFrame(updateSoulPosition);
  }

  function startBattleLoop() {
    soul.x = canvas.width / 2;
    soul.y = canvas.height - 140;
    battlePhase = 'menu';
    bullets = [];
    appendCombatLog(`Battle vs ${enemy.name} starts!`);
    updateEnemyBar();
    updatePlayerBar();
  }

  function resetAll() {
    player.hp = player.maxHp;
    player.exp = 0;
    currentEncounterIndex = 0;
    enemy = null;
    bullets = [];
    combatLog.innerHTML = '';
    currentDialogue = [];
    dialogueIndex = 0;
    setState('menu');
    stopMusic();
  }

  // initialization
  setState('menu');
  lastTime = performance.now();
  requestAnimationFrame(drawScene);
  requestAnimationFrame(updateSoulPosition);

  // small helpful hints
  appendCombatLog('Welcome to the small demo — press START to play.');
  appendCombatLog('During enemy attacks, use arrow keys or WASD to dodge the red bullets.');

  // expose for debug in console (optional)
  window._grimGame = {
    startIntro,
    prepareEncounter,
    resetAll,
    state,
    player,
    encounters
  };
})();
