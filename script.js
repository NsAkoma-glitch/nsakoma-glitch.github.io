/* =========================================================
   koma — script.js
   フレームワークなしの素の JavaScript だけで書いています。
   <script src="script.js" defer> なので、HTML を読み終わってから実行されます。

   目次
     0. 共通の道具
     1. 絶叫 / 低音モードの切り替え
     2. オープニング演出
     3. 名前のスクランブル演出
     4. FPS 風の照準カーソル
     5. スポットライトと 3D チルト
     6. スクロールで現れる
     7. ランクの階段
     8. 24時間ダイヤル
     9. トランプをめくる
    10. 進捗バーとナビの現在地
    11. 配信中かどうかの確認
    12. シェアボタン
    13. 隠しコマンド
    14. 開発者ツールを開いた人へ
    15. フォロワー限定のジョーカー
   ========================================================= */

const TWITCH_ID = 'nsa_koma';
const SITE_URL = 'https://nsakoma-glitch.github.io/';
// Twitch の開発者ページで登録したアプリの ID（公開しても大丈夫な値）
const TWITCH_CLIENT_ID = '1hu600oiivf27lvppofnp9og8bs0y9';
const ACTIVE_FROM = 19; // 活動時間の始まり（19時）
const ACTIVE_TO = 2;    // 活動時間の終わり（深夜2時）


/* ---------- 0. 共通の道具 ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// 「動きを減らす」設定の人と、マウスで操作している人を判定
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

// localStorage はプライベートモードなどで使えないことがあるので try で包む
const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* 保存できなくても動く */ } },
};

// JS が動いていることを CSS に伝える目印
document.documentElement.classList.add('js');
if (reducedMotion) document.documentElement.classList.add('no-motion');

// 画面下にメッセージを出す
let toastTimer;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('is-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-show'), 2600);
}


/* ---------- 1. 絶叫 / 低音モードの切り替え ---------- */
const root = document.documentElement;
const themeColor = $('meta[name="theme-color"]');

function applyMode(mode) {
  root.dataset.mode = mode;
  themeColor.setAttribute('content', mode === 'loud' ? '#f4f2ee' : '#111114');
  store.set('koma-mode', mode);
}

// 前回選んだモードを復元
applyMode(store.get('koma-mode') === 'loud' ? 'loud' : 'low');

// クリックした位置から円が広がるように切り替える（View Transitions API）
function switchMode(mode, x = innerWidth / 2, y = innerHeight / 2) {
  if (mode === root.dataset.mode) return;

  if (!document.startViewTransition || reducedMotion) {
    applyMode(mode);
  } else {
    const transition = document.startViewTransition(() => applyMode(mode));
    // 画面の一番遠い角までの距離 = 円の最終的な半径
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    transition.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 650, easing: 'cubic-bezier(.16,1,.3,1)', pseudoElement: '::view-transition-new(root)' }
      );
    });
  }

  // 絶叫モードにしたら画面を揺らす
  if (mode === 'loud' && !reducedMotion) {
    document.body.classList.remove('shaking');
    void document.body.offsetWidth; // アニメーションを最初からやり直すための小技
    document.body.classList.add('shaking');
  }
  toast(mode === 'loud' ? '📢 うるkoma 降臨！' : '🎧 チルkoma……');
}

// 円の中心。キーボードで押したとき（座標が 0,0）は、ボタンの真ん中から広げる
function originOf(e) {
  if (e.clientX || e.clientY) return [e.clientX, e.clientY];
  const rect = e.currentTarget.getBoundingClientRect();
  return [rect.left + rect.width / 2, rect.top + rect.height / 2];
}
$('#mode-toggle').addEventListener('click', (e) => {
  switchMode(root.dataset.mode === 'loud' ? 'low' : 'loud', ...originOf(e));
});
$$('[data-set-mode]').forEach((card) => {
  card.addEventListener('click', (e) => switchMode(card.dataset.setMode, ...originOf(e)));
});


/* ---------- 2. オープニング演出 ---------- */
// 同じタブで2回目以降は出さない（毎回だとしつこいので）
function playIntro() {
  const intro = $('#intro');
  let seen = false;
  try { seen = sessionStorage.getItem('koma-intro') === '1'; sessionStorage.setItem('koma-intro', '1'); } catch { /* 無視 */ }
  if (seen || reducedMotion) return Promise.resolve();

  // 画面を 80px くらいのタイルで埋める
  const size = 80;
  const cols = Math.ceil(innerWidth / size);
  const rows = Math.ceil(innerHeight / size);
  const tiles = $('#intro-tiles');
  tiles.style.setProperty('--cols', cols);
  tiles.style.setProperty('--rows', rows);

  // 中心から外側へ向かって順番にめくれるよう、距離で遅延を決める
  const cx = (cols - 1) / 2, cy = (rows - 1) / 2;
  const maxDist = Math.hypot(cx, cy);
  const frag = document.createDocumentFragment();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = document.createElement('span');
      if ((r + c) % 2) tile.className = 'w';
      tile.style.setProperty('--d', `${(Math.hypot(c - cx, r - cy) / maxDist) * 0.5}s`);
      frag.appendChild(tile);
    }
  }
  tiles.appendChild(frag);
  intro.classList.add('is-playing');

  return new Promise((resolve) => {
    const open = () => {
      intro.classList.add('is-open');
      setTimeout(() => { intro.remove(); resolve(); }, 1100);
    };
    const timer = setTimeout(open, 1000);
    // クリックでスキップ
    intro.addEventListener('click', () => { clearTimeout(timer); open(); }, { once: true });
  });
}


/* ---------- 3. 名前のスクランブル演出 ---------- */
const nameEl = $('#name');
const NAME = nameEl.textContent.trim();
nameEl.innerHTML = [...NAME].map((ch) => `<span class="ch" aria-hidden="true">${ch}</span>`).join('');
const nameChars = $$('.ch', nameEl);
const GLYPHS = '♠♥♣♦#%&$@KOMA';

let scrambling = false;
function scrambleName() {
  if (scrambling || reducedMotion) return;
  scrambling = true;
  const start = performance.now();

  function frame(now) {
    const t = now - start;
    let done = 0;
    nameChars.forEach((span, i) => {
      if (t > 250 + i * 140) {        // この文字は確定
        span.textContent = NAME[i];
        span.classList.remove('is-scrambling');
        done++;
      } else {                        // まだランダムな記号
        span.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        span.classList.add('is-scrambling');
      }
    });
    if (done < nameChars.length) requestAnimationFrame(frame);
    else scrambling = false;
  }
  requestAnimationFrame(frame);
}
nameEl.addEventListener('mouseenter', scrambleName);


/* ---------- 4. FPS 風の照準カーソル ---------- */
if (finePointer) {
  const cross = $('#crosshair');
  root.classList.add('has-crosshair');

  let x = -100, y = -100;   // マウスの実際の位置
  let cx = x, cy = y;       // 照準が今いる位置（少し遅れて追いかける）

  addEventListener('pointermove', (e) => {
    x = e.clientX; y = e.clientY;
    if (cx < 0) { cx = x; cy = y; }
  });
  document.addEventListener('pointerleave', () => { x = y = cx = cy = -100; });

  // リンクやボタンの上では照準が開く
  document.addEventListener('pointerover', (e) => {
    cross.classList.toggle('is-hover', !!e.target.closest('a, button'));
  });

  // クリックするとヒットマーカー
  addEventListener('pointerdown', (e) => {
    cross.classList.add('is-firing');
    const hit = document.createElement('div');
    hit.className = 'hitmarker';
    hit.style.left = `${e.clientX}px`;
    hit.style.top = `${e.clientY}px`;
    document.body.appendChild(hit);
    hit.addEventListener('animationend', () => hit.remove());
  });
  addEventListener('pointerup', () => cross.classList.remove('is-firing'));

  // 毎フレーム、目標に 35% ずつ近づける（なめらかに追従する仕組み）
  (function loop() {
    const k = reducedMotion ? 1 : 0.35;
    cx += (x - cx) * k;
    cy += (y - cy) * k;
    cross.style.setProperty('--x', `${cx}px`);
    cross.style.setProperty('--y', `${cy}px`);
    requestAnimationFrame(loop);
  })();
}


/* ---------- 5. スポットライトと 3D チルト ---------- */
if (finePointer && !reducedMotion) {
  const hero = $('.hero');
  hero.addEventListener('pointermove', (e) => {
    const rect = hero.getBoundingClientRect();
    hero.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    hero.style.setProperty('--my', `${e.clientY - rect.top}px`);
  });

  // data-tilt が付いた要素は、マウスの位置に合わせて傾く
  $$('[data-tilt]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;   // 0〜1
      const py = (e.clientY - rect.top) / rect.height;   // 0〜1
      el.style.setProperty('--ry', `${(px - 0.5) * 14}deg`);
      el.style.setProperty('--rx', `${(0.5 - py) * 14}deg`);
      el.style.setProperty('--gx', `${px * 100}%`);
      el.style.setProperty('--gy', `${py * 100}%`);
      el.style.setProperty('--go', '1');
    });
    el.addEventListener('pointerleave', () => {
      ['--rx', '--ry'].forEach((p) => el.style.setProperty(p, '0deg'));
      el.style.setProperty('--go', '0');
    });
  });
}


/* ---------- 6. スクロールで現れる ---------- */
// 同じ親の中の .reveal には、少しずつ遅れて出るよう遅延を付ける
$$('.reveal').forEach((el) => {
  const siblings = $$(':scope > .reveal', el.parentElement);
  el.style.setProperty('--delay', `${siblings.indexOf(el) * 0.08}s`);
});

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-visible');
    revealObserver.unobserve(entry.target);
  });
}, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

$$('.reveal').forEach((el) => revealObserver.observe(el));


/* ---------- 7. ランクの階段 ---------- */
// HTML の data-tiers と data-current から棒グラフを作る
$$('.game-card').forEach((card) => {
  const tiers = card.dataset.tiers.split(',');
  const current = Number(card.dataset.current);
  const ladder = $('.ladder', card);

  const steps = tiers.map((tier, i) => {
    const state = i < current ? 'done' : i === current ? 'now' : '';
    return `<span class="${state}" style="--i:${i}" title="${tier}"></span>`;
  }).join('');

  // --n（棒の数）と --cur（今の位置）を CSS に渡して、▲ を今の棒の真下に置く
  ladder.innerHTML = `
    <div class="ladder-steps" style="--step:${80 / (tiers.length - 1)}%">${steps}</div>
    <div class="ladder-marker" style="--n:${tiers.length}; --cur:${current}"><b>▲<br>${tiers[current]}</b></div>
    <div class="ladder-labels"><span>${tiers[0]}</span><span>${tiers.at(-1)}</span></div>`;
});


/* ---------- 8. 24時間ダイヤル ---------- */
const SVG_NS = 'http://www.w3.org/2000/svg';
const dial = $('#dial');
const C = 120;  // 中心
const R = 96;   // 輪の半径

// 「◯時」を時計の角度に変える（0時が真上、右回り）
const hourToAngle = (h) => (h / 24) * 360 - 90;
const polar = (angle, radius) => {
  const rad = (angle * Math.PI) / 180;
  return [C + radius * Math.cos(rad), C + radius * Math.sin(rad)];
};
function svg(tag, attrs, text) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  if (text) el.textContent = text;
  dial.appendChild(el);
  return el;
}

function drawDial() {
  // 背景の輪
  svg('circle', { class: 'ring-bg', cx: C, cy: C, r: R });

  // 活動時間の弧（19時 → 26時 = 深夜2時）
  const end = ACTIVE_TO + 24;
  const [x1, y1] = polar(hourToAngle(ACTIVE_FROM), R);
  const [x2, y2] = polar(hourToAngle(end), R);
  const large = end - ACTIVE_FROM > 12 ? 1 : 0;
  svg('path', { class: 'ring-on', d: `M${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2}` });

  // 弧の真ん中に月
  const [mx, my] = polar(hourToAngle((ACTIVE_FROM + end) / 2), R + 20);
  svg('text', { class: 'moon', x: mx, y: my }, '🌙');

  // 目盛り（6時間ごとに太く、数字付き）
  for (let h = 0; h < 24; h++) {
    const major = h % 6 === 0;
    const [ax, ay] = polar(hourToAngle(h), R - 14);
    const [bx, by] = polar(hourToAngle(h), R - (major ? 24 : 18));
    svg('line', { class: major ? 'tick major' : 'tick', x1: ax, y1: ay, x2: bx, y2: by });
    if (major) {
      const [lx, ly] = polar(hourToAngle(h), R + 18); // 数字は輪の外側に
      svg('text', { class: 'hour-label', x: lx, y: ly }, String(h));
    }
  }

  // 針と中心
  const hand = svg('line', { class: 'hand', x1: C, y1: C, x2: C, y2: C - (R - 30) });
  hand.style.transformOrigin = `${C}px ${C}px`;
  svg('circle', { class: 'hub', cx: C, cy: C, r: 5 });
  const timeText = svg('text', { class: 'center-time', x: C, y: C + 38 }, '--:--');
  svg('text', { class: 'center-sub', x: C, y: C + 52 }, 'JST NOW');
  return { hand, timeText };
}

const dialParts = drawDial();

// 見ている人がどこにいても、日本時間で計算する
function nowInJapan() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { hour: get('hour'), minute: get('minute') };
}

let isLive = false;
function updateTime() {
  const { hour, minute } = nowInJapan();
  const value = hour + minute / 60;
  dialParts.hand.style.transform = `rotate(${(value / 24) * 360}deg)`;
  dialParts.timeText.textContent = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  const active = hour >= ACTIVE_FROM || hour < ACTIVE_TO;
  const status = $('#now-status');
  status.classList.toggle('on', active || isLive);
  status.textContent = isLive
    ? '🔴 いままさに配信中！'
    : active
      ? '🌙 今は koma の活動時間！配信中かも？'
      : '☀ 今は準備中。夜にまた会いましょう。';
}
updateTime();
setInterval(updateTime, 30_000);


/* ---------- 9. トランプをめくる ---------- */
$$('.cards .card').forEach((card) => {
  card.addEventListener('click', () => {
    const flipped = card.getAttribute('aria-pressed') === 'true';
    card.setAttribute('aria-pressed', String(!flipped));
    // 4枚全部めくったらご褒美
    if ($$('.cards .card[aria-pressed="true"]').length === 4 && !flipped) {
      toast('🎩 全部めくれました。ようこそ、koma の配信へ！');
    }
  });
});


/* ---------- 10. 進捗バーとナビの現在地 ---------- */
const progress = $('#progress');
function onScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  progress.style.setProperty('--p', max > 0 ? scrollY / max : 0);
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

const navLinks = $$('.nav-links a');
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((a) => a.classList.toggle('is-current', a.hash === `#${entry.target.id}`));
  });
}, { rootMargin: '-45% 0px -50% 0px' });
$$('main section[id]').forEach((s) => sectionObserver.observe(s));


/* ---------- 11. 配信中かどうかの確認 ---------- */
// DecAPI という無料サービスを使うと、APIキーなしで配信時間を取得できます。
// 配信していないときは「nsa_koma is offline」のような文字が返ってきます。
// ※ URL の最後に ?live=1 を付けると、配信中の見た目を試せます。
async function checkLive() {
  const forced = new URLSearchParams(location.search).has('live');
  let live = forced;

  if (!forced) {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 5000); // 5秒で諦める
      const res = await fetch(`https://decapi.me/twitch/uptime/${TWITCH_ID}`, { signal: controller.signal });
      const text = (await res.text()).trim();
      live = res.ok && /\d+\s*(second|minute|hour|day)/i.test(text) && !/offline/i.test(text);
    } catch {
      live = false; // 取得に失敗したら「オフライン」扱いにして何もしない
    }
  }
  if (!live) return;

  isLive = true;
  updateTime();

  const pill = $('#live-pill');
  pill.classList.add('is-live');
  $('.live-text', pill).textContent = 'LIVE NOW';

  const watch = $('#hero-watch');
  watch.classList.add('is-live');
  $('.btn-label', watch).textContent = 'いま配信中！見に行く';

  // Twitch のプレイヤーを埋め込む（parent に今のドメインが必要）
  if (location.hostname) {
    const iframe = document.createElement('iframe');
    iframe.src = `https://player.twitch.tv/?channel=${TWITCH_ID}&parent=${location.hostname}&muted=true`;
    iframe.title = 'koma の Twitch 配信';
    iframe.allowFullscreen = true;
    $('#player').appendChild(iframe);
    $('#live').hidden = false;
  }
}
checkLive();

// 今のフォロワー数と、次の目標までの人数をトップに出す
// これも DecAPI を使うと、ログインなしで人数（数字だけ）が返ってきます。
const FOLLOWER_GOALS = [10, 25, 50, 100, 200, 300, 500, 1000, 2000, 5000, 10000]; // 足したり変えたりしてOK
async function showFollowerGoal() {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://decapi.me/twitch/followcount/${TWITCH_ID}`, { signal: controller.signal });
    const text = (await res.text()).trim();
    if (!res.ok || !/^\d+$/.test(text)) return; // 数字以外（エラー文など）なら何も出さない
    const total = Number(text);

    const goal = FOLLOWER_GOALS.find((g) => g > total);
    const box = $('#follow-goal');
    box.innerHTML = `
      <p class="follow-goal-now">フォロワー <b>${total.toLocaleString()}</b> 人</p>
      ${goal ? `
        <p class="follow-goal-next">次の目標 ${goal.toLocaleString()} 人まで、あと <b>${(goal - total).toLocaleString()}</b> 人！</p>
        <div class="follow-goal-bar" aria-hidden="true"><i style="--p:${total / goal}"></i></div>` : ''}`;
    box.hidden = false;
  } catch { /* 取れなかったら何も出さない */ }
}
showFollowerGoal();


/* ---------- 12. シェアボタン ---------- */
const shareText = 'うるせーkoma か、チルいkoma か。VALORANT / Apex を配信している koma のページ 🎩';
$('#share-link').href =
  `https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(SITE_URL)}`;


/* ---------- 13. 隠しコマンド ---------- */
// ↑↑↓↓←→←→BA でマジックショー（スマホはフッターの矢印を押す）
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let konamiIndex = 0;
addEventListener('keydown', (e) => {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  konamiIndex = key === KONAMI[konamiIndex] ? konamiIndex + 1 : (key === KONAMI[0] ? 1 : 0);
  if (konamiIndex === KONAMI.length) { konamiIndex = 0; magicShow(); }
});
$('.hint').addEventListener('click', magicShow);

function magicShow() {
  toast("🎩 It's showtime! トリック成功！");
  if (reducedMotion) return;

  const canvas = $('#fx');
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);

  // トランプのマークと肉球を降らせる
  const symbols = ['♠', '♥', '♣', '♦', '🐾', '🎩'];
  const colors = ['#f4f2ee', '#c8141b', '#f2b705', '#141418'];
  const parts = Array.from({ length: 140 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 120,
    y: innerHeight + 20,
    vx: (Math.random() - 0.5) * 16,
    vy: -(Math.random() * 18 + 14),
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    size: Math.random() * 18 + 18,
    symbol: symbols[Math.floor(Math.random() * symbols.length)],
    color: colors[Math.floor(Math.random() * colors.length)],
  }));

  (function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    let alive = 0;
    for (const p of parts) {
      p.vy += 0.45;          // 重力
      p.vx *= 0.99;          // 空気抵抗
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      if (p.y < innerHeight + 60) alive++;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.font = `${p.size}px serif`;
      ctx.fillStyle = p.color;
      ctx.textAlign = 'center';
      ctx.fillText(p.symbol, 0, 0);
      ctx.restore();
    }
    if (alive) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })();
}


/* ---------- 14. 開発者ツールを開いた人へ ---------- */
console.log(
  '%c koma %c\nソースを見てくれてありがとう。\nフレームワークなし、素の HTML / CSS / JS だけで作っています。\nヒント: ↑↑↓↓←→←→BA',
  'font: 48px "Dela Gothic One", sans-serif; color: #f4f2ee; background: #111114; text-shadow: 3px 3px 0 #c8141b; padding: 4px 12px;',
  'font: 13px monospace; color: #c8141b;'
);


/* ---------- 15. フォロワー限定のジョーカー ---------- */
// 仕組み（サーバーなしで動く「インプリシット・グラント」という方法）
//   1. ジョーカーを押す → Twitch のログイン画面へ移動
//   2. ログインすると、このサイトに戻ってくる。URL の # の後ろに「アクセストークン」が付いている
//   3. そのトークンで Twitch API に「この人は koma をフォローしてる？」と聞く
//   4. フォローしていればカードがめくれる
// トークンはこのタブの中（sessionStorage）にだけ置き、koma にも誰にも送りません。
const joker = $('#joker');
const jokerStatus = $('#joker-status');
const JOKER_TOKEN_KEY = 'koma-twitch-token';
const JOKER_STATE_KEY = 'koma-twitch-state';

const session = {
  get(key) { try { return sessionStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { sessionStorage.setItem(key, value); } catch { /* 無視 */ } },
  remove(key) { try { sessionStorage.removeItem(key); } catch { /* 無視 */ } },
};

function setJokerStatus(html, kind = '') {
  jokerStatus.innerHTML = html;
  jokerStatus.dataset.kind = kind;
}

// フォローしてからの期間（months = 何か月から）でランクが上がる。
// message は ` ` で囲んでいるので、そのまま改行すればサイトでも改行されます。
// そのランク以上の人だけに見えるメッセージです。段を増やしたいときは、同じ形で足すだけでOK。
const JOKER_TIERS = [
  { months: 0, id: 'bronze', name: 'BRONZE', message:
`まずはフォローありがとう！ここはフォロワーだけが見られる秘密のカードだよ！
このwebページ作るの大変だったからさ、これみてフォローしてくれたって子だったら素直に嬉しい！ありがとう😊
普通に他から来た人もめっちゃ嬉しい！ありがとう😊
これから先も応援してくれるとこれから下がどんどんめくれると思うから、このまま僕のこと頼んだぞ！` },

  { months: 6, id: 'silver', name: 'SILVER', message:
`半年も続いてるマ？！
あのね、君ちょっとおかしいよ笑
でも、ありがとう😊
こんな変なやつを応援してくれて📣
こんな変なやつのことこれからもよろしく頼むぞ！
by 19歳のkoma` },

  { months: 12, id: 'gold', name: 'GOLD', message:
`え？一緒に四季堪能しちゃったか？
もう友達やん笑
俺は君がいつも観に来てくれて本当に嬉しいし、名前だって言ってないかもしれないけどちゃんと覚えてるよ…
いつもありがとう😊
今までコメントしたことなかったらこれを機にやってみようか？めっちゃ反応するで！
これからもよろしく頼むぞ！
by 19歳のkoma` },

  { months: 36, id: 'platinum', name: 'PLATINUM', message:
`もう3年か…
一緒に高校生活過ごしたのと一緒だからな。普通に…
もしかしてたら一緒に過ごしてるやつも居るかもな笑
今まで活動続けれたのもさ、君がさ、さいっっっしょの頃に僕を見つけてくれたからだぜ。本当にありがとうございます。
なんか恥ずいけど、マジでありがとうやで😊
これから先も頼むで！コメント待ってるで！` },

  { months: 60, id: 'diamond', name: 'DIAMOND', message:
`5年はもう古参超えて家族です。
5年も活動している自分にもびっくりやし、それをずっとフォローしている君にもびっくり笑
あのー、たぶんずっと言ってると思うけどほんまにありがとう😊
これねマッッジで感謝しているからね！
ほんまにありがとう😊
これからも支えてやってや！` },
];

const DAY = 24 * 60 * 60 * 1000;
// 日付に◯か月を足す（月末の日付がずれないように調整）
function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== day) d.setDate(0); // 例: 8/31 + 6か月 → 2/28
  return d;
}

// ランクに合わせてカードとメッセージ一覧を描く
// followedAt が null のときは koma 本人 → 全部見える
function renderJokerTier(followedAt) {
  const now = new Date();
  const unlockDate = (tier) => (followedAt ? addMonths(followedAt, tier.months) : new Date(0));
  const unlocked = JOKER_TIERS.filter((t) => unlockDate(t) <= now);
  const tier = unlocked.at(-1);
  const next = JOKER_TIERS[unlocked.length];
  const days = followedAt ? Math.floor((now - followedAt) / DAY) + 1 : null;

  joker.dataset.tier = tier.id;
  $('#joker-tier-name').textContent = `${tier.name} JOKER`;
  $('#joker-days').textContent = days ? `フォロー ${days} 日目` : 'koma 本人';
  $('#joker-next').textContent = next
    ? `あと ${Math.ceil((unlockDate(next) - now) / DAY)} 日で ${next.name}`
    : '最高ランク！';

  // 解放済みはメッセージ、まだのものは鍵と解放までの日数
  $('#joker-tiers').innerHTML = JOKER_TIERS.map((t) => {
    const open = unlockDate(t) <= now;
    const left = Math.ceil((unlockDate(t) - now) / DAY);
    return `<li class="joker-tier ${open ? 'is-open' : ''}" data-tier="${t.id}">
      <span class="joker-tier-badge">${t.name}<small>${t.months ? `${t.months / 12}年〜` : 'フォローしたら'}</small></span>
      <span class="joker-tier-msg">${open ? escapeHtml(t.message) : `🔒 あと ${left} 日で解放`}</span>
    </li>`;
  }).join('');
  $('#joker-tiers').hidden = false;
}

// Twitch のログイン画面へ
function loginWithTwitch() {
  // state: なりすまし防止のための使い捨ての合言葉。戻ってきたときに同じか確かめる
  const state = crypto.getRandomValues(new Uint32Array(4)).join('-');
  session.set(JOKER_STATE_KEY, state);
  const params = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    redirect_uri: SITE_URL,
    response_type: 'token',
    scope: 'user:read:follows',
    state,
  });
  location.href = `https://id.twitch.tv/oauth2/authorize?${params}`;
}

// Twitch API を呼ぶ小さな関数
async function twitchApi(path, token) {
  const res = await fetch(`https://api.twitch.tv/helix/${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Client-Id': TWITCH_CLIENT_ID },
  });
  if (res.status === 401) throw new Error('expired');
  if (!res.ok) throw new Error(`twitch ${res.status}`);
  return (await res.json()).data;
}

// フォローしているか確認して、していればめくる
async function checkFollow(token) {
  setJokerStatus('🔍 フォローしているか確認中…');
  try {
    const [me] = await twitchApi('users', token);                       // ログインした人
    const [koma] = await twitchApi(`users?login=${TWITCH_ID}`, token);  // koma
    const isKoma = me.id === koma.id;
    // フォローしていれば、followed_at（フォローした日時）が返ってくる
    const [follow] = isKoma ? [null] : await twitchApi(
      `channels/followed?user_id=${me.id}&broadcaster_id=${koma.id}`, token);

    if (isKoma || follow) {
      renderJokerTier(isKoma ? null : new Date(follow.followed_at));
      joker.setAttribute('aria-pressed', 'true');
      joker.classList.remove('is-locked');
      setJokerStatus(`🃏 ${escapeHtml(me.display_name)} さん、フォローありがとう！`, 'ok');
      toast('🃏 ジョーカー解放！');
    } else {
      setJokerStatus(
        `😢 ${escapeHtml(me.display_name)} さんは、まだフォローしていないみたい…<br>
         <a href="https://www.twitch.tv/${TWITCH_ID}" target="_blank" rel="noopener">Twitch でフォロー</a>してから、もう一度カードを押してね！`,
        'ng');
    }
  } catch (err) {
    if (err.message === 'expired') {
      session.remove(JOKER_TOKEN_KEY); // 期限切れ → もう一度ログインしてもらう
      setJokerStatus('ログインの期限が切れました。もう一度カードを押してね。', 'ng');
    } else {
      setJokerStatus('うまく確認できませんでした。時間をおいて、もう一度押してね。', 'ng');
    }
  }
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

joker.addEventListener('click', () => {
  if (!joker.classList.contains('is-locked')) {
    // 解放済みなら、ふつうのカードと同じように裏返せる
    joker.setAttribute('aria-pressed', String(joker.getAttribute('aria-pressed') !== 'true'));
    return;
  }
  const token = session.get(JOKER_TOKEN_KEY);
  if (token) checkFollow(token);
  else loginWithTwitch();
});

// Twitch のログイン画面から戻ってきたときの処理
(function handleTwitchReturn() {
  const hash = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  const state = hash.get('state') || query.get('state');
  if (!state) return;

  const expected = session.get(JOKER_STATE_KEY);
  session.remove(JOKER_STATE_KEY);
  // URL からトークンを消しておく（履歴やスクショに残らないように）
  history.replaceState(null, '', location.pathname + '#joker-area');
  $('#joker-area').scrollIntoView();

  if (state !== expected) return; // 合言葉が違う → 無視
  if (query.get('error') || hash.get('error')) {
    setJokerStatus('ログインがキャンセルされました。', 'ng');
    return;
  }
  const token = hash.get('access_token');
  if (!token) return;
  session.set(JOKER_TOKEN_KEY, token);
  checkFollow(token);
})();


/* ---------- スタート ---------- */
$('#year').textContent = new Date().getFullYear();
playIntro().then(scrambleName);
