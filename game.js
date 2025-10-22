// Undertale-like battle & text-RPG overhaul for Grim
// - interactive battle menu (Fight, Act, Item, Mercy)
// - ACT: multiple acts including CHECK and custom acts
// - items spawn/appear and can be used/picked up
// - bullet-hell 'fight' minigame remains but refined
// - mercy system and routes (pacifist / neutral / genocide)
// - save/load to localStorage
// - more polished UI hooks (works with existing HTML if present)

(() => {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) {
    console.warn('game-canvas not found in DOM — aborting game.js init');
    return;
  }
  const ctx = canvas.getContext('2d');
  const startBtn = document.getElementById('start-game');
  const resetBtn = document.getElementById('reset-game');
  const saveBtn = document.getElementById('save-game');
  const loadBtn = document.getElementById('load-game');
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
  const actsList = document.getElementById('acts-list');
  const itemsList = document.getElementById('items-list');
  const menuInfo = document.getElementById('menu-info');

  // --- sound setup (reuse previous audioMap, allow for missing files) ---
  const audioMap = {
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
    'bg-exploration': 'snd/snowdin_bridge.ogg',
    'bg-battle': 'snd/sandstorm.ogg'
  };
  const baseAudio = {};
  function playSfx(name, opts = {}) {
    const url = audioMap[name];
    if (!url) return null;
    try {
      const base = baseAudio[name];
      if (base && !base.loop) {
        const node = base.cloneNode();
        node.volume = (opts.volume ?? 0.9);
        node.currentTime = 0;
        node.play().catch(()=>{});
        return node;
      }
      const a = new Audio(url);
      a.preload = 'auto';
      a.volume = (opts.volume ?? 0.9);
      a.play().catch(()=>{});
      return a;
    } catch (e) { return null; }
  }
  let currentMusic = null;
  function playMusic(name, opts = {}) {
    const url = audioMap[name]; if (!url) return;
    if (currentMusic && currentMusic._name === name && !currentMusic.paused) return;
    if (currentMusic) try { currentMusic.pause(); } catch (e) {}
    let a = baseAudio[name];
    if (!a) {
      a = new Audio(url);
      a.loop = true;
      a.preload = 'auto';
      a.volume = (opts.volume ?? 0.5);
      baseAudio[name] = a;
    }
    a._name = name;
    a.currentTime = opts.startTime || 0;
    a.play().catch(()=>{});
    currentMusic = a;
  }
  function stopMusic() { if (currentMusic) try { currentMusic.pause(); } catch(e) {} currentMusic = null; }
  Object.keys(audioMap).forEach(k => { try { const a = new Audio(audioMap[k]); a.preload='auto'; baseAudio[k]=a; } catch(e){} });

  // --- story & encounters ---
  const story = {
    intro: [
      "THE CHRONICLES OF GRIM GREASER",
      "You are Grim. A kid in Ridgewood High with a talent for trouble and snacks.",
      "You notice something's off — shadows moving where they shouldn't."
    ],
    hallway: [
      "* Zoey fusses about her papers.",
      "* Zack is suspiciously close to the vending machine.",
      "Mia: Grim! I baked something for you..."
    ],
    endingPacifist: [
      "You chose mercy and kindness. Ridgewood breathes easier.",
      "Pacifist ending — to be continued."
    ],
    endingGenocide: [
      "Your path left nothing behind. Silence answers.",
      "Genocide ending — consequences echo."
    ],
    endingNeutral: [
      "You survived, changed but uncertain.",
      "Neutral ending — the story goes on."
    ]
  };

  const baseEncounters = [
    {
      id: 'library-ghost',
      name: 'Library Ghost',
      maxHp: 50,
      hp: 50,
      attack: 10,
      defense: 3,
      exp: 25,
      mercyThreshold: 0.2, // percent
      acts: [
        { id: 'joke', label: 'Tell a joke', outcome: (e) => ({ text:`The ghost giggles. It seems calmer.`, mercy:true }) },
        { id: 'compliment', label: 'Compliment', outcome: (e) => ({ text:`It drifts closer, listening.`, mercy:false }) }
      ],
      dialog: ["A ghost drifts from the dusty shelves!"],
      flavor: "A lost student who can't find her notes."
    },
    {
      id: 'shadow-wraith',
      name: 'Shadow Wraith',
      maxHp: 80,
      hp: 80,
      attack: 14,
      defense: 6,
      exp: 40,
      mercyThreshold: 0.22,
      acts: [
        { id:'showlight', label:'Shine Light', outcome: (e) => ({ text:`You flash a light — the shadow recoils.`, mercy:false }) },
        { id:'humm', label:'Humm a tune', outcome:(e)=> ({ text:`The wraith seems distracted.`, mercy:true }) }
      ],
      dialog: ["A writhing shadow stalks you!", "It feeds on fear..."] ,
      flavor: "Something formed from forgotten anger."
    },
    {
      id: 'mia-boss',
      name: 'Mia',
      maxHp: 140,
      hp: 140,
      attack: 18,
      defense: 8,
      exp: 80,
      mercyThreshold: 0.28,
      acts: [
        { id:'talk', label:'Talk', outcome:(e)=> ({ text:`You talk to Mia about feelings. She falters.`, mercy:false }) },
        { id:'remin', label:'Reminisce', outcome:(e)=> ({ text:`A memory surfaces — Mia looks away.`, mercy:true }) }
      ],
      dialog: [
        "Mia: You can't avoid me forever, Grim!",
        "Mia: We are meant to be together."
      ],
      flavor: "An obsessive friend who refuses to let go."
    }
  ];

  // persist a working copy of encounters so we can reset per-save
  let encounters = JSON.parse(JSON.stringify(baseEncounters));

  // player state
  const player = { maxHp:100, hp:100, level:1, exp:0, items: [ { id:'snack', name:'Snack', heal:20, qty:2 } ] };

  // route tracking
  let killsCount = 0;
  let mercyCount = 0;

  // game state machine
  let state = 'menu'; // menu | intro | exploration | battleStart | battle | victory | ending | gameover
  let currentDialogue = [];
  let dialogueIndex = 0;
  let currentEncounterIndex = 0;
  let enemy = null;
  let battlePhase = 'menu'; // menu | attackpattern | resolving
  let lastTime = 0;

  // soul (player heart)
  const soul = { x: canvas.width/2, y: canvas.height-140, size:18, speed:4 };
  const keys = {};
  let bullets = [];

  // UI helpers
  function setState(newState) {
    state = newState;
    if (stateLabel) stateLabel.textContent = state.toUpperCase();
    if (state === 'menu') {
      if (dialogueBox) dialogueBox.classList.add('hidden');
      if (battleUI) battleUI.classList.add('hidden');
      stopMusic();
    } else if (state === 'intro' || state === 'exploration' || state === 'victory' || state === 'ending' || state === 'gameover') {
      if (dialogueBox) dialogueBox.classList.remove('hidden');
      if (battleUI) battleUI.classList.add('hidden');
      if (state === 'exploration' || state === 'intro' || state === 'ending') playMusic('bg-exploration',{volume:0.45});
    } else if (state === 'battleStart') {
      if (dialogueBox) dialogueBox.classList.remove('hidden');
      if (battleUI) battleUI.classList.add('hidden');
    } else if (state === 'battle') {
      if (dialogueBox) dialogueBox.classList.add('hidden');
      if (battleUI) battleUI.classList.remove('hidden');
      playMusic('bg-battle',{volume:0.45});
      renderBattleMenu();
    }
  }

  function startIntro() { currentDialogue = [...story.intro]; dialogueIndex = 0; setState('intro'); updateDialogue(); playSfx('start'); }

  function updateDialogue() {
    if (!dialogueBox || !dialogueText) return;
    if (dialogueIndex < currentDialogue.length) {
      dialogueText.textContent = currentDialogue[dialogueIndex];
    } else {
      if (state === 'intro') { currentDialogue = [...story.hallway]; dialogueIndex=0; setState('exploration'); updateDialogue(); }
      else if (state === 'exploration') { prepareEncounter(currentEncounterIndex); }
      else if (state === 'battleStart') { setState('battle'); startBattleLoop(); }
      else if (state === 'victory') { currentEncounterIndex++; if (currentEncounterIndex < encounters.length) { currentDialogue = ['After a short rest, you continue...']; dialogueIndex=0; setState('exploration'); updateDialogue(); } else { // ending by route
          decideEnding(); } }
      else if (state === 'ending' || state === 'gameover') { setState('menu'); }
    }
  }

  if (nextBtn) nextBtn.addEventListener('click', ()=>{ playSfx('ui-click'); dialogueIndex++; updateDialogue(); });
  if (startBtn) startBtn.addEventListener('click', ()=>{ playSfx('ui-click'); resetAll(); startIntro(); });
  if (resetBtn) resetBtn.addEventListener('click', ()=>{ playSfx('doorclose'); resetAll(); setState('menu'); });
  if (saveBtn) saveBtn.addEventListener('click', ()=>{ saveGame(); playSfx('ui-click'); });
  if (loadBtn) loadBtn.addEventListener('click', ()=>{ loadGame(); playSfx('ui-click'); });

  function prepareEncounter(idx) {
    enemy = JSON.parse(JSON.stringify(encounters[idx]));
    currentDialogue = enemy.dialog.slice();
    dialogueIndex = 0;
    setState('battleStart');
    updateDialogue();
    if (enemyHPFill) enemyHPFill.style.width = `${(enemy.hp/enemy.maxHp)*100}%`;
    if (playerHPFill) playerHPFill.style.width = `${(player.hp/player.maxHp)*100}%`;
    if (enemyNameLabel) enemyNameLabel.textContent = enemy.name.toUpperCase();
  }

  // Action button wiring (Fight, Act, Item, Mercy) — existing buttons should have data-action
  actionButtons.forEach(btn => { btn.addEventListener('click', ()=>{ const act = btn.dataset.action; if (state !== 'battle' || battlePhase !== 'menu') return; playSfx('ui-click'); performAction(act); }); });

  function performAction(action) {
    appendCombatLog(`You chose: ${action.toUpperCase()}`);
    if (action === 'fight') { enterFightMinigame(); }
    else if (action === 'act') { openActMenu(); }
    else if (action === 'item') { openItemMenu(); }
    else if (action === 'mercy') { attemptMercy(); }
  }

  // ACT system
  function openActMenu() {
    if (!actsList || !menuInfo) return;
    actsList.innerHTML = '';
    menuInfo.textContent = 'Choose an ACT to try to befriend or weaken the enemy.';
    enemy.acts.forEach(a => {
      const b = document.createElement('button');
      b.className = 'act-btn';
      b.textContent = a.label;
      b.addEventListener('click',()=>{
        playSfx('act');
        const out = a.outcome(enemy);
        appendCombatLog(out.text);
        if (out.mercy) { enemy._canMercy = true; appendCombatLog(`${enemy.name} looks more merciful...`); }
        closeMenus();
        setTimeout(()=>{ startEnemyAttack(); }, 600);
      });
      actsList.appendChild(b);
    });
    // add CHECK act
    const checkBtn = document.createElement('button');
    checkBtn.className = 'act-btn check';
    checkBtn.textContent = 'CHECK';
    checkBtn.addEventListener('click',()=>{
      playSfx('ui-click');
      const info = `${enemy.name}: ${enemy.flavor} \nHP: ${enemy.hp}/${enemy.maxHp} \nAttack: ${enemy.attack}`;
      appendCombatLog(info);
      menuInfo.textContent = 'Check reveals info about the enemy.';
    });
    actsList.appendChild(checkBtn);
  }

  // Item menu
  function openItemMenu() {
    if (!itemsList || !menuInfo) return;
    itemsList.innerHTML = '';
    menuInfo.textContent = 'Choose an item to use or click item to pick up (if present).';
    player.items.forEach((it, idx)=>{
      const b = document.createElement('button');
      b.className = 'item-btn';
      b.textContent = `${it.name} x${it.qty}`;
      b.addEventListener('click',()=>{
        if (it.qty <= 0) { appendCombatLog('No more of that item.'); return; }
        playSfx('item');
        player.hp = Math.min(player.maxHp, player.hp + it.heal);
        it.qty--;
        appendCombatLog(`Used ${it.name}: +${it.heal} HP`);
        updatePlayerBar();
        closeMenus();
        setTimeout(()=>{ startEnemyAttack(); }, 600);
      });
      itemsList.appendChild(b);
    });
  }
  function closeMenus() { if (actsList) actsList.innerHTML=''; if (itemsList) itemsList.innerHTML=''; if (menuInfo) menuInfo.textContent=''; }

  // Attempt mercy
  function attemptMercy() {
    playSfx('ui-click');
    const threshold = enemy.mercyThreshold || 0.25;
    const hpPercent = enemy.hp / enemy.maxHp;
    if (enemy._canMercy || hpPercent <= threshold) {
      playSfx('mercy-success');
      appendCombatLog(`${enemy.name} shows mercy and leaves.`);
      mercyCount++;
      onVictory(true);
    } else {
      playSfx('mercy-fail');
      appendCombatLog(`${enemy.name} refuses mercy!`);
      setTimeout(()=> startEnemyAttack(), 600);
    }
  }

  // Fight minigame — opens attack pattern where player tries to hit enemy with bullets (optional: keep simple)
  function enterFightMinigame() {
    battlePhase = 'attackpattern';
    playSfx('fight-hit');
    appendCombatLog('You choose to FIGHT — dodge and collide with projectiles to deal damage.');
    bullets = [];
    const patternCount = 8 + Math.floor(enemy.attack/3);
    for (let i=0;i<patternCount;i++) {
      bullets.push({ x: canvas.width/2, y: canvas.height/2, vx:(Math.random()-0.5)*6, vy:(Math.random()-0.5)*6, r:6 + Math.random()*8, color:'#ff8888' });
    }
    // brief window to 'land hits'
    const fightDuration = 1400 + Math.random()*600;
    setTimeout(()=>{
      const hits = Math.max(1, Math.floor(Math.random() * 4) + Math.floor(bullets.length/10));
      const rawDmg = 6 + Math.floor(Math.random()*18);
      const dmg = Math.max(1, rawDmg + hits - enemy.defense);
      enemy.hp = Math.max(0, enemy.hp - dmg);
      appendCombatLog(`You dealt ${dmg} damage!`);
      updateEnemyBar();
      bullets = [];
      battlePhase = 'menu';
      if (enemy.hp <= 0) { onVictory(false); }
      else { setTimeout(()=> startEnemyAttack(), 450); }
    }, fightDuration);
  }

  // Enemy attack patterns
  let attackActive = false;
  function startEnemyAttack() {
    if (!enemy) return;
    battlePhase = 'attackpattern';
    attackActive = true;
    playSfx('enemy-attack');
    bullets = [];
    const patternCount = Math.min(18, Math.floor(enemy.attack/2)+6);
    for (let i=0;i<patternCount;i++) {
      const angle = (i/patternCount)*Math.PI*2 + (Math.random()*0.8-0.4);
      const speed = 1.2 + Math.random()*2 + (enemy.attack/20);
      bullets.push({ x: Math.random()*canvas.width, y: -20 - Math.random()*120, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed + 0.4, r:6+Math.random()*8, color:'#ff4d4d' });
    }
    // run for a while
    setTimeout(()=>{
      const hits = checkSoulCollisions();
      const dmg = Math.min(player.hp, Math.max(0, Math.floor((enemy.attack/6)*hits)));
      if (dmg>0) { player.hp = Math.max(0, player.hp - dmg); playSfx('player-hurt'); appendCombatLog(`${enemy.name} deals ${dmg} damage.`); updatePlayerBar(); }
      else { playSfx('ui-click'); appendCombatLog('You dodged the attack!'); }
      bullets=[]; attackActive=false; battlePhase='menu';
      if (player.hp <=0) { setTimeout(()=>{ setState('gameover'); playSfx('gameover'); currentDialogue = ['You fell down...','This is not necessarily the end.']; dialogueIndex=0; dialogueBox.classList.remove('hidden'); battleUI.classList.add('hidden'); }, 600); }
    }, 1600 + Math.random()*1000);
  }

  function checkSoulCollisions() {
    // simulate collisions: count bullets close to soul
    let hits = 0;
    bullets.forEach(b=>{ const dx=b.x-soul.x; const dy=b.y-soul.y; const d=Math.sqrt(dx*dx+dy*dy); if (d < b.r + soul.size) hits++; });
    return Math.min(10,hits);
  }

  function onVictory(mercied=false) {
    if (mercied) {
      playSfx('mercy-success');
      appendCombatLog(`${enemy.name} has been spared.`);
    } else {
      playSfx('victory');
      appendCombatLog(`${enemy.name} defeated! You gain ${enemy.exp} EXP.`);
      killsCount++;
    }
    player.exp += enemy.exp;
    player.hp = Math.min(player.maxHp, player.hp + (mercied?8:12));
    updatePlayerBar();
    setState('victory');
    currentDialogue = [ enemy.name + (mercied? ' fades away peacefully...' : ' collapses...') ];
    dialogueIndex = 0;
    if (dialogueBox) dialogueBox.classList.remove('hidden');
    if (battleUI) battleUI.classList.add('hidden');
  }

  function updateEnemyBar() { if (enemyHPFill) enemyHPFill.style.width = `${(enemy.hp/enemy.maxHp)*100}%`; }
  function updatePlayerBar() { if (playerHPFill) playerHPFill.style.width = `${(player.hp/player.maxHp)*100}%`; }
  function appendCombatLog(text) { if (!combatLog) return; combatLog.classList.remove('hidden'); const p=document.createElement('div'); p.textContent = `• ${text}`; p.style.fontFamily='"Press Start 2P", monospace'; p.style.fontSize='12px'; combatLog.appendChild(p); combatLog.scrollTop = combatLog.scrollHeight; }

  // items that can appear on the battle field (pickups)
  let fieldItems = [];
  function spawnFieldItem(item) { // item: {id,name,heal}
    const fi = { ...item, x: 60 + Math.random()*(canvas.width-120), y: 80 + Math.random()*120, r:14 };
    fieldItems.push(fi);
    appendCombatLog(`An item appeared: ${item.name}. Click it to pick up.`);
  }

  canvas.addEventListener('click', (e)=>{
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
    // pick up items
    for (let i=fieldItems.length-1;i>=0;i--) {
      const it = fieldItems[i]; const dx=mx-it.x; const dy=my-it.y; if (Math.sqrt(dx*dx+dy*dy) < it.r+6) { // pick
        playSfx('item');
        const slot = player.items.find(s=>s.id===it.id);
        if (slot) slot.qty++; else player.items.push({ id:it.id, name:it.name, heal:it.heal, qty:1 });
        appendCombatLog(`Picked up: ${it.name}`);
        fieldItems.splice(i,1); return;
      }
    }
  });

  // rendering
  function drawBackground() {
    const g = ctx.createLinearGradient(0,0,0,canvas.height);
    g.addColorStop(0,'#07071a'); g.addColorStop(1,'#0b0b12'); ctx.fillStyle=g; ctx.fillRect(0,0,canvas.width,canvas.height);
  }
  function drawScene(time) {
    const dt = (time-lastTime)/1000; lastTime=time;
    drawBackground();
    // show different scenes
    if (state === 'battle' || state === 'battleStart' || state === 'victory') {
      // enemy
      ctx.fillStyle='#fff'; ctx.font='48px serif'; ctx.fillText('👻', canvas.width/2-24, 110);
      // bullets
      bullets.forEach(b=>{ b.x += b.vx; b.y += b.vy; if (b.y>canvas.height+80||b.x<-80||b.x>canvas.width+80) { b.x=Math.random()*canvas.width; b.y=-20; } ctx.beginPath(); ctx.fillStyle=b.color; ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill(); });
      // soul
      ctx.save(); ctx.translate(soul.x,soul.y); ctx.fillStyle='#ff6699'; drawHeart(ctx,0,0,soul.size); ctx.restore();
      // field items
      fieldItems.forEach(it=>{ ctx.beginPath(); ctx.fillStyle='#ffd27f'; ctx.arc(it.x,it.y,it.r,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#000'; ctx.font='12px monospace'; ctx.fillText(it.name, it.x-10, it.y+4); });
      // HUD hints
      ctx.fillStyle='rgba(255,255,255,0.8)'; ctx.font='14px monospace'; ctx.fillText(`HP: ${player.hp}/${player.maxHp}`, 12, 24);
    } else {
      ctx.fillStyle='#fff'; ctx.font='20px "Press Start 2P", monospace'; if (state==='intro' || state==='exploration' || state==='battleStart' || state==='victory') ctx.fillText('— Story & Exploration —',20,40); else ctx.fillText('Press START to begin your adventure.',20,40);
    }
    if (bullets.length>0) { ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.font='14px monospace'; ctx.fillText(`Incoming: ${bullets.length}`,12,canvas.height-12); }
    requestAnimationFrame(drawScene);
  }
  function drawHeart(ctx,x,y,size){ const s=size; ctx.beginPath(); ctx.moveTo(x,y+s/4); ctx.bezierCurveTo(x,y-s/2,x-s,y-s/2,x-s,y+s/4); ctx.bezierCurveTo(x-s,y+s,x,y+s*1.4,x,y+s*1.8); ctx.bezierCurveTo(x,y+s*1.4,x+s,y+s,x+s,y+s/4); ctx.bezierCurveTo(x+s,y-s/2,x,y-s/2,x,y+s/4); ctx.fill(); }

  // soul movement
  window.addEventListener('keydown',(e)=>{ keys[e.key.toLowerCase()]=true; if (['arrowleft','arrowright','arrowup','arrowdown'].includes(e.key.toLowerCase())) e.preventDefault(); // quick save/load
    if (e.key.toLowerCase()==='p') { saveGame(); appendCombatLog('Game saved.'); }
    if (e.key.toLowerCase()==='o') { loadGame(); appendCombatLog('Game loaded.'); }
  });
  window.addEventListener('keyup',(e)=>{ keys[e.key.toLowerCase()]=false; });
  function updateSoulPosition(){ if (state==='battle' && battlePhase==='attackpattern') { if (keys['arrowleft']||keys['a']) soul.x-=soul.speed*2; if (keys['arrowright']||keys['d']) soul.x+=soul.speed*2; if (keys['arrowup']||keys['w']) soul.y-=soul.speed*2; if (keys['arrowdown']||keys['s']) soul.y+=soul.speed*2; const left=60,right=canvas.width-60,top=canvas.height-220,bottom=canvas.height-60; soul.x=Math.max(left,Math.min(right,soul.x)); soul.y=Math.max(top,Math.min(bottom,soul.y)); } else { soul.x += (canvas.width/2 - soul.x)*0.08; soul.y += ((canvas.height-140) - soul.y)*0.08; } requestAnimationFrame(updateSoulPosition); }

  function startBattleLoop(){ soul.x=canvas.width/2; soul.y=canvas.height-140; battlePhase='menu'; bullets=[]; appendCombatLog(`Battle vs ${enemy.name} starts!`); updateEnemyBar(); updatePlayerBar(); // spawn an item sometimes
    if (Math.random() < 0.5) spawnFieldItem({ id:'snack', name:'Snack', heal:20 });
  }

  function resetAll(){ player.hp=player.maxHp; player.exp=0; player.items=[{id:'snack',name:'Snack',heal:20,qty:2}]; encounters = JSON.parse(JSON.stringify(baseEncounters)); currentEncounterIndex=0; enemy=null; bullets=[]; if (combatLog) combatLog.innerHTML=''; currentDialogue=[]; dialogueIndex=0; killsCount=0; mercyCount=0; fieldItems=[]; setState('menu'); stopMusic(); }

  // Save / Load
  function saveGame(){ const data = { player, encounters, currentEncounterIndex, killsCount, mercyCount, state, enemy, fieldItems }; try { localStorage.setItem('grim_save_v1', JSON.stringify(data)); } catch(e){ console.warn('Save failed',e); } }
  function loadGame(){ try { const raw = localStorage.getItem('grim_save_v1'); if (!raw) { appendCombatLog('No save found.'); return; } const data = JSON.parse(raw); Object.assign(player, data.player); encounters = data.encounters; currentEncounterIndex = data.currentEncounterIndex; killsCount = data.killsCount; mercyCount = data.mercyCount; fieldItems = data.fieldItems || []; if (data.enemy) enemy = data.enemy; updatePlayerBar(); if (enemy) updateEnemyBar(); appendCombatLog('Loaded save.'); } catch(e){ console.warn('Load failed',e); appendCombatLog('Load failed.'); } }

  // decide ending by route
  function decideEnding(){ // simple rules: genocide if kills >= full count, pacifist if kills===0 and mercyCount === totalEncounters, neutral otherwise
    const total = baseEncounters.length;
    if (killsCount >= total) { currentDialogue = story.endingGenocide.slice(); setState('ending'); dialogueIndex=0; }
    else if (killsCount === 0 && mercyCount >= total) { currentDialogue = story.endingPacifist.slice(); setState('ending'); dialogueIndex=0; }
    else { currentDialogue = story.endingNeutral.slice(); setState('ending'); dialogueIndex=0; }
  }

  // renderBattleMenu: small helper to ensure menus exist in DOM, otherwise just no-op
  function renderBattleMenu() {
    // if your HTML has elements for acts/items/menu info, this ensures they're updated
    if (menuInfo) menuInfo.textContent = '';
    if (actsList) actsList.innerHTML = '';
    if (itemsList) itemsList.innerHTML = '';
    // by default, leave UI wiring to the existing DOM; this function can be expanded
  }

  // expose debug
  window._grimGame = { player, encounters, resetAll, saveGame, loadGame, startIntro };

  // init
  setState('menu'); lastTime = performance.now(); requestAnimationFrame(drawScene); requestAnimationFrame(updateSoulPosition);
  appendCombatLog('Small demo loaded. Press START to play. Press P to save, O to load.');
})();
