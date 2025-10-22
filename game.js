/* Grim Greaser: Ridgewood — Undertale-like prototype
   Minimal Phaser 3 game with Overworld + Battle + Dialogue/Act system.
   Controls: Arrow keys (move), Enter (interact), Z (confirm), X (cancel)
*/

const WIDTH = 800, HEIGHT = 600;

class BootScene extends Phaser.Scene {
  constructor(){ super('BootScene'); }
  preload(){
    // no external assets; using graphics & text
  }
  create(){
    this.scene.start('OverworldScene');
  }
}

class OverworldScene extends Phaser.Scene {
  constructor(){ super('OverworldScene'); }
  create(){
    // world background
    this.cameras.main.setBackgroundColor('#0b1020');

    // simple tile-ish ground
    const g = this.add.graphics();
    g.fillStyle(0x112233,1);
    g.fillRect(0,0,WIDTH,HEIGHT);

    // streets / park rectangle
    g.fillStyle(0x163a2b,1);
    g.fillRect(40,120,720,380);

    // create player (Grim)
    this.player = this.add.rectangle(120,200,28,36,0x2ea3ff).setOrigin(0.5);
    this.player.name = 'Grim';

    // NPCs from story (simple)
    this.npcs = this.add.group();
    const makeNPC=(x,y,color,name,dialog)=>{
      const r = this.add.rectangle(x,y,28,36,color).setOrigin(0.5);
      r.name = name;
      r.dialog = dialog || ["..."];
      this.npcs.add(r);
      const label = this.add.text(x-40,y+26,name,{fontSize:12, color:'#fff'}).setOrigin(0,0);
      return r;
    };

    this.zoey = makeNPC(300,200,0xff88cc,'Zoey',[
      "Zoey: Stay sharp, Grim.",
      "Zoey: I'm studying clues about the missing parents."
    ]);
    this.zack = makeNPC(420,320,0x9999ff,'Zack',[
      "Zack: Got snacks? Let's go cause trouble!",
      "Zack: Epic trick incoming!"
    ]);
    this.mia = makeNPC(600,220,0xff3366,'Mia',[
      "Mia: You belong with me, Grim.",
      "Mia: I only want to keep you safe."
    ]);
    this.bandit = makeNPC(200,360,0x999999,'Bandit',[
      "Bandit: (woof)"
    ]);

    // text prompt
    this.hint = this.add.text(12,HEIGHT-28,"Use arrow keys to move, Enter to interact",{fontSize:14,color:'#ffffff'});

    // keyboard
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyEnter = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    // simple movement variables
    this.speed = 160;

    // collision bounds
    this.physics = this.physics || this.scene;
    this.playerData = {x:this.player.x, y:this.player.y};
  }

  update(time, delta){
    // movement
    let vx=0, vy=0;
    if (this.cursors.left.isDown) vx=-1;
    else if (this.cursors.right.isDown) vx=1;
    if (this.cursors.up.isDown) vy=-1;
    else if (this.cursors.down.isDown) vy=1;
    const norm = vx||vy ? Math.sqrt(vx*vx+vy*vy) : 1;
    this.player.x += (vx? vx/norm:0)*this.speed*(delta/1000);
    this.player.y += (vy? vy/norm:0)*this.speed*(delta/1000);

    // interact
    if (Phaser.Input.Keyboard.JustDown(this.keyEnter)){
      const near = this.npcs.getChildren().find(n=>{
        return Phaser.Math.Distance.Between(this.player.x,this.player.y,n.x,n.y) < 60;
      });
      if (near){
        // interactions: if Mia and hostile, start battle; else show dialogue
        if (near.name === 'Mia' || near.name === 'Bandit' && Math.random()<0.15){
          // possibility to trigger a battle with a Shadow Wraith if interaction with Mia is ominous
          this.scene.pause();
          this.scene.launch('BattleScene',{enemyKey:'shadow', from:'overworld', caller:near.name});
        } else {
          this.showDialogue(near.dialog);
        }
      }
    }
  }

  showDialogue(lines){
    // simple modal
    const w=600,h=140;
    const box = this.add.rectangle(WIDTH/2,HEIGHT-110,w,h,0x08111a,0.95).setStrokeStyle(2,0x3aa6ff);
    const txt = this.add.text(WIDTH/2 - w/2 + 12, HEIGHT-160, lines[0], {fontSize:16, color:'#fff', wordWrap:{width:w-24}});
    let idx=0;
    const keyZ = this.input.keyboard.addKey('Z');
    const advance = ()=>{
      idx++;
      if (idx >= lines.length){ box.destroy(); txt.destroy(); keyZ.destroy(); }
      else txt.setText(lines[idx]);
    };
    keyZ.on('down', advance);
  }
}

class BattleScene extends Phaser.Scene {
  constructor(){ super('BattleScene'); }
  init(data){
    this.enemyKey = data.enemyKey || 'shadow';
    this.origin = data.from || 'overworld';
    this.caller = data.caller || '';
  }
  create(){
    // dark overlay
    this.cameras.main.setBackgroundColor('#05040f');
    // enemy definitions
    this.enemies = {
      shadow: {
        name: 'Shadow Wraith',
        hp: 30,
        maxHp: 30,
        color: 0x660000,
        acts: {
          'Talk': {mood: -2, text: "The wraith shivers at your words."},
          'Joke': {mood: -1, text: "A hollow chuckle echoes."},
          'Show Locket': {mood: +3, text: "The wraith recognises something... it's calmer."}
        }
      }
    };
    this.enemy = JSON.parse(JSON.stringify(this.enemies[this.enemyKey]));

    // UI panels
    this.txtEnemy = this.add.text(WIDTH/2,120,this.enemy.name,{fontSize:28,color:'#ffdddd'}).setOrigin(0.5);
    this.enemyBar = this.add.rectangle(WIDTH/2,160,300,12,0xff4444).setOrigin(0.5);

    // player "soul" and bullet arena
    this.arena = this.add.rectangle(WIDTH/2,HEIGHT/2 - 20,460,220,0x081018).setStrokeStyle(2,0xffffff);
    // player's heart
    this.heart = this.add.circle(WIDTH/2, HEIGHT/2 + 40, 8, 0xffffff);

    // menu UI
    this.menuChoices = ['Fight','Act','Item','Mercy'];
    this.menuIndex = 0;
    this.menuText = this.add.text(40,HEIGHT-160,'',{fontSize:20,color:'#fff'});
    this.updateMenu();

    // simple status
    this.enemyMood = 0; // higher -> more pacified

    // keyboard
    this.left = this.input.keyboard.addKey('LEFT');
    this.right = this.input.keyboard.addKey('RIGHT');
    this.z = this.input.keyboard.addKey('Z');

    // state
    this.inFightMinigame = false;
    this.projectiles = [];

    // instructions
    this.instr = this.add.text(40,HEIGHT-40,"Use ← → to choose, Z to confirm",{fontSize:14,color:'#aabbcc'});

    // capture escape: if over world
    this.sceneLauncher = this.scene.get(this.origin);
  }

  updateMenu(){
    let str = '';
    for (let i=0;i<this.menuChoices.length;i++){
      str += (i===this.menuIndex? '▶ ':'  ') + this.menuChoices[i] + '\n';
    }
    this.menuText.setText(str);
  }

  update(time,dt){
    if (this.inFightMinigame){
      // mini fight: spawn red projectiles intermittently
      if (Math.random() < 0.02) this.spawnProjectile();
      this.projectiles.forEach(p=>{
        p.y += p.speed;
        p.x += Math.sin((time+p.offset)*0.01)*p.wobble;
        if (Phaser.Math.Distance.Between(p.x,p.y,this.heart.x,this.heart.y) < 12){
          // hit
          this.cameras.main.shake(80,0.01);
          // small penalty: reduce player 'stability' -> immediate result as losing HP or just reduce enemy mood
          this.enemy.moodDamage = (this.enemy.moodDamage||0)+1;
          p.dead = true;
        }
        if (p.y > HEIGHT+50) p.dead = true;
      });
      this.projectiles = this.projectiles.filter(p=>!p.dead);
      return;
    }

    // menu navigation
    if (Phaser.Input.Keyboard.JustDown(this.left)) { this.menuIndex = (this.menuIndex+this.menuChoices.length-1)%this.menuChoices.length; this.updateMenu(); }
    if (Phaser.Input.Keyboard.JustDown(this.right)) { this.menuIndex = (this.menuIndex+1)%this.menuChoices.length; this.updateMenu(); }

    if (Phaser.Input.Keyboard.JustDown(this.z)){
      const choice = this.menuChoices[this.menuIndex];
      if (choice === 'Fight') { this.startFightMinigame(); }
      else if (choice === 'Act'){ this.openActMenu(); }
      else if (choice === 'Item'){ this.showMessage("You rummage... nothing helpful."); }
      else if (choice === 'Mercy'){ this.attemptMercy(); }
    }

    // update HP bar width
    const ratio = Math.max(0, this.enemy.hp / this.enemy.maxHp);
    this.enemyBar.width = 300 * ratio;
  }

  startFightMinigame(){
    this.inFightMinigame = true;
    this.showMessage("You attack! Dodge to land the hit.");
    // spawn a directed volley for a short time, after 1500ms stop and register hit
    this.time.delayedCall(2200, ()=>{
      this.inFightMinigame = false;
      // calculate damage: fewer hits taken -> more damage
      const misses = this.enemy.moodDamage || 0;
      const dmg = Math.max(2, 8 - misses);
      this.enemy.hp -= dmg;
      this.enemy.moodDamage = 0;
      this.showMessage("You dealt "+dmg+" damage!");
      if (this.enemy.hp <= 0){ this.onEnemyDefeated(false); }
    });
  }

  spawnProjectile(){
    const x = Phaser.Math.Between(WIDTH/2 - 200, WIDTH/2 + 200);
    const p = {x:x, y: -20, speed: Phaser.Math.Between(1,3), wobble:Phaser.Math.Between(10,40), offset:Phaser.Math.Between(0,4000)};
    p.rect = this.add.circle(p.x,p.y,6,0xff4444);
    p.dead = false;
    this.projectiles.push(p);
    // cleanup graphics each tick: move rect with p
    this.time.addEvent({delay:16, loop:true, callback:()=>{
      p.rect.x = p.x; p.rect.y = p.y; if (p.dead){ p.rect.destroy(); } }, callbackScope:this});
  }

  openActMenu(){
    // simple dialog showing Acts
    const acts = Object.keys(this.enemy.acts);
    let idx=0;
    const width=420, height=120;
    const box = this.add.rectangle(WIDTH/2,HEIGHT/2+160,width,height,0x081018,0.98).setStrokeStyle(2,0x66ffcc);
    const text = this.add.text(WIDTH/2 - width/2 + 10, HEIGHT/2+110, acts.map((a,i)=> ((i===idx)?'▶ ':'  ')+a).join('\n'),{fontSize:16,color:'#fff'});
    const left = this.input.keyboard.addKey('LEFT'), right = this.input.keyboard.addKey('RIGHT'), z=this.input.keyboard.addKey('Z'), x=this.input.keyboard.addKey('X');
    const update = ()=>{
      text.setText(acts.map((a,i)=> ((i===idx)?'▶ ':'  ')+a).join('\n'));
    };
    const cleanup = ()=>{
      box.destroy(); text.destroy(); left.destroy(); right.destroy(); z.destroy(); x.destroy();
    };
    const onConfirm = ()=>{
      const act = acts[idx];
      const effect = this.enemy.acts[act];
      this.enemyMood += (effect.mood||0);
      this.showMessage(effect.text);
      cleanup();
    };
    left.on('down',()=>{ idx=(idx+acts.length-1)%acts.length; update(); });
    right.on('down',()=>{ idx=(idx+1)%acts.length; update(); });
    z.on('down', onConfirm);
    x.on('down', ()=>{ cleanup(); });
  }

  attemptMercy(){
    // simple mercy logic: if mood high enough -> spare
    if (this.enemyMood >= 3 || this.enemy.hp <= 4){
      this.showMessage("You mercied the enemy!");
      this.onEnemyDefeated(true);
    } else {
      this.showMessage("The enemy isn't ready to be spared.");
      // enemy might retaliate: small damage to player or increase hostility
      this.enemy.hp = Math.min(this.enemy.maxHp, this.enemy.hp + 2);
      this.enemyMood = Math.max(0, this.enemyMood - 1);
    }
  }

  onEnemyDefeated(spared){
    if (spared){
      this.showMessage(`${this.enemy.name} spared. Peace achieved.`, ()=> this.endBattle(true));
    } else {
      this.showMessage(`${this.enemy.name} defeated.`, ()=> this.endBattle(false));
    }
  }

  endBattle(spared){
    // clean up and return to overworld
    this.time.delayedCall(400, ()=>{
      this.scene.stop();
      this.scene.resume('OverworldScene');
      // show small message in overworld
      const ow = this.scene.get('OverworldScene');
      ow.showDialogue([spared? "You spared the enemy." : "You defeated the enemy."]);
    });
  }

  showMessage(msg, cb){
    if (this._modal) this._modal.destroy();
    const w=680,h=80;
    this._modal = this.add.container(WIDTH/2, HEIGHT-60);
    const bg = this.add.rectangle(0,0,w,h,0x07121a,0.96).setStrokeStyle(2,0x66ffcc);
    const txt = this.add.text(-w/2+12,-12, msg, {fontSize:16, color:'#fff', wordWrap:{width:w-24}});
    this._modal.add([bg, txt]);
    if (this._clearTimer) this._clearTimer.remove();
    this._clearTimer = this.time.delayedCall(1600, ()=>{ this._modal.destroy(); this._modal = null; if (cb) cb(); });
  }
}

const config = {
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  parent: 'game-container',
  scene: [BootScene, OverworldScene, BattleScene],
  backgroundColor: '#0b1020'
};

const game = new Phaser.Game(config);

// Optional: expose game for console tinkering
window._game = game;
