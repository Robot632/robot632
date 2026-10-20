// -----------------------------------------------------------
// Trophies, shared by every page that loads this file.
//
//   R632Ach.unlock('id')  -- unlocks a trophy (once) and shows a
//                            small "trophy unlocked" toast
//   R632Ach.has('id')     -- true if already unlocked
//   R632Ach.LIST          -- every trophy, in display order
//   R632Ach.unlocked()    -- { id: timestamp } of unlocked ones
//
// To add a trophy: add an entry to LIST and call unlock() with its
// id wherever it's earned. `secret: true` hides the description
// on the trophies page until it's unlocked.
//
// Saved in this browser's localStorage only (robot632_achievements),
// like the rest of the site's settings.
// -----------------------------------------------------------
(function(){
  const KEY = 'robot632_achievements';

  const LIST = [
    { id: 'powered_on',     icon: '🔌', title: 'Powered on',              desc: 'Visit the home page.' },
    { id: 'night_owl',      icon: '🦉', title: 'Night owl',               desc: 'Visit between midnight and 5 am.' },
    { id: 'early_bird',     icon: '🐦', title: 'Early bird',              desc: 'Visit between 5 and 7 am.' },
    { id: 'high_graphics',  icon: '✨', title: 'Eye candy',               desc: 'Turn on High graphics.' },
    { id: 'holiday',        icon: '🎉', title: 'Festive bot',             desc: 'Visit on a holiday with High graphics on.' },
    { id: 'roblox',         icon: '🎮', title: 'Blocky',                  desc: 'Check out the Roblox page.' },
    { id: 'roblox_play',    icon: '▶️', title: 'Player one',              desc: 'Open one of the games from the Roblox page.' },
    { id: 'terminal',       icon: '⌨️', title: 'Hacker voice',            desc: 'Find the terminal.', secret: true },
    { id: 'corner',         icon: '📡', title: 'Signal found',            desc: 'Find the hidden corner page.', secret: true },
    { id: 'sudo',           icon: '💥', title: 'Oops',                    desc: 'Try to delete everything.', secret: true },
    { id: 'hacker',         icon: '🛰️', title: 'Mainframe',               desc: 'Hack NASA (allegedly).', secret: true },
    { id: 'matrix',         icon: '🟩', title: 'Follow the white rabbit', desc: 'Enter the matrix.', secret: true },
    { id: 'fortune',        icon: '🔮', title: 'Fortune teller',          desc: 'Ask the terminal for your fortune.', secret: true },
    { id: 'cowsay',         icon: '🐮', title: 'Moo',                     desc: 'Make the cow talk.', secret: true },
    { id: 'pip_fed',        icon: '🔩', title: 'Snack time',              desc: 'Feed Pip a bolt.' },
    { id: 'pip_10',         icon: '🧢', title: 'Fresh fit',               desc: 'Feed Pip 10 bolts.' },
    { id: 'pip_50',         icon: '🎨', title: 'New paint job',           desc: 'Feed Pip 50 bolts.' },
    { id: 'pip_100',        icon: '👑', title: 'Royal Pip',               desc: 'Feed Pip 100 bolts.' },
    { id: 'signal_win',     icon: '🟦', title: 'Perfect recall',          desc: 'Win Signal Sequence.' },
    { id: 'flappy_10',      icon: '🪽', title: 'Frequent flyer',          desc: 'Score 10 in Flappy Robot.' },
    { id: 'snake_20',       icon: '🐍', title: 'Nut collector',           desc: 'Collect 20 nuts in Snake.' },
    { id: 'reflex_250',     icon: '⚡', title: 'Lightning',               desc: 'React in under 250 ms.' },
    { id: 'breakout_clear', icon: '🧱', title: 'Wall breaker',            desc: 'Clear a whole Breakout wall.' },
    { id: 'whack_30',       icon: '🔨', title: 'Bot whacker',             desc: 'Whack 30 bots in one Whack-a-bot round.' },
    { id: 'arcade',         icon: '🕹️', title: 'Arcade regular',          desc: 'Play every game in the game picker.' }
  ];

  function read(){
    try{
      const v = JSON.parse(localStorage.getItem(KEY));
      return v && typeof v === 'object' ? v : {};
    } catch (e){ return {}; }
  }

  function write(map){
    try { localStorage.setItem(KEY, JSON.stringify(map)); } catch (e){}
  }

  // ---------- toast ----------
  let toastBox = null;
  const queue = [];
  let showing = false;

  function ensureToastBox(){
    if (toastBox) return;
    const style = document.createElement('style');
    style.textContent = `
      .r632-toast-box{ position:fixed; bottom:42px; left:50%; translate:-50% 0; z-index:9999; pointer-events:none; }
      .r632-toast{ display:flex; align-items:center; gap:10px; padding:9px 16px 9px 12px; border-radius:14px;
        background:rgba(14,20,24,0.92); color:#fff; border:1px solid rgba(255,214,90,0.55);
        box-shadow:0 10px 26px rgba(0,0,0,0.4), 0 0 18px rgba(255,200,60,0.25);
        font:800 13px/1.25 'Nunito', system-ui, -apple-system, 'Segoe UI', sans-serif; white-space:nowrap;
        transition: opacity 0.3s ease, translate 0.3s ease; }
      .r632-toast.out{ opacity:0; translate:0 16px; }
      .r632-toast-icon{ font-size:22px; }
      .r632-toast small{ display:block; font-size:10px; letter-spacing:0.08em; text-transform:uppercase; color:#ffd65a; }
    `;
    document.head.appendChild(style);
    toastBox = document.createElement('div');
    toastBox.className = 'r632-toast-box';
    toastBox.setAttribute('role', 'status');
    toastBox.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastBox);
  }

  function chime(){
    let on = true;
    try { on = localStorage.getItem('robot632_sound') !== 'off'; } catch (e){}
    if (!on) return;
    try{
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [660, 880, 1320].forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const t = ctx.currentTime + i * 0.09;
        o.type = 'triangle';
        o.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
        o.connect(g).connect(ctx.destination);
        o.start(t);
        o.stop(t + 0.27);
      });
      setTimeout(() => ctx.close(), 800);
    } catch (e){}
  }

  function nextToast(){
    if (showing || !queue.length) return;
    showing = true;
    const a = queue.shift();
    ensureToastBox();
    const el = document.createElement('div');
    el.className = 'r632-toast out';
    el.innerHTML = `<span class="r632-toast-icon" aria-hidden="true"></span><span><small>Trophy unlocked</small><span class="r632-toast-title"></span></span>`;
    el.querySelector('.r632-toast-icon').textContent = a.icon;
    el.querySelector('.r632-toast-title').textContent = a.title;
    toastBox.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('out')));
    chime();
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => { el.remove(); showing = false; nextToast(); }, 320);
    }, 3200);
  }

  function unlock(id){
    const a = LIST.find(x => x.id === id);
    if (!a) return false;
    const map = read();
    if (map[id]) return false;
    map[id] = Date.now();
    write(map);
    queue.push(a);
    if (document.body) nextToast();
    else document.addEventListener('DOMContentLoaded', nextToast, { once: true });
    return true;
  }

  window.R632Ach = {
    LIST,
    unlock,
    has: (id) => !!read()[id],
    unlocked: read
  };
})();
