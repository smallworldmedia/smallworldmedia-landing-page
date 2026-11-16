// ?histlog=1 — an on-device history log (SQ-105), off by default.
//
// Safari's back-list skipping and the iOS edge-swipe can't be shown in
// Playwright, so the iPhone walk itself is the oracle: this HUD lists every
// pushState / replaceState / popstate and ClientRouter's preparation + swap,
// with the path, history.length, the state's keys (+ swmWorld), the user
// activation at the call and a popstate's hasUAVisualTransition. Screenshot
// it after each Back. The rows live in sessionStorage (one key, the last
// CAP rows), so they survive soft navigations and a bfcache restore; the flag
// sticks for the tab until ?histlog=0. Nothing is wrapped while it is off.

const ROWS_KEY = 'swm:histlog';
const ON_KEY = 'swm:histlog:on';
export const CAP = 60;

/** One log row as a line: `07 +3.2s PUSH /work/a len4 {index,scrollX,scrollY} w1 ua1/1 uav1`. */
export function formatRow(r) {
  const n = String(r.n).padStart(2, '0');
  const t = `+${(r.t / 1000).toFixed(1)}s`;
  const keys = r.keys ? `{${r.keys.join(',')}}` : 'null';
  const parts = [n, t, r.kind, r.path, `len${r.len}`, keys];
  if (r.world !== undefined) parts.push(`w${r.world}`);
  if (r.ua) parts.push(`ua${r.ua[0] ? 1 : 0}/${r.ua[1] ? 1 : 0}`);
  if (r.uav !== undefined) parts.push(`uav${r.uav ? 1 : 0}`);
  if (r.note) parts.push(r.note);
  return parts.join(' ');
}

/** Rows + one more, numbered on from the last, the oldest dropped past cap. */
export function appendRow(rows, row, cap = CAP) {
  const n = rows.length ? rows[rows.length - 1].n + 1 : 1;
  return [...rows, { ...row, n }].slice(-cap);
}

const flag = (k) => new URLSearchParams(window.location.search).get(k);

function install() {
  const ss = window.sessionStorage;
  const t0 = Number(ss.getItem(ON_KEY + ':t0')) || Date.now();
  ss.setItem(ON_KEY + ':t0', String(t0));
  let rows = [];
  try {
    rows = JSON.parse(ss.getItem(ROWS_KEY) || '[]');
  } catch {
    rows = [];
  }

  const pathOf = (u) => {
    try {
      return new URL(u ?? window.location.href, window.location.href).pathname;
    } catch {
      return String(u);
    }
  };
  const log = (kind, extra = {}) => {
    const s = window.history.state;
    const ua = window.navigator.userActivation;
    rows = appendRow(rows, {
      t: Date.now() - t0,
      kind,
      path: pathOf(extra.url),
      len: window.history.length,
      keys: s && typeof s === 'object' ? Object.keys(s) : null,
      world: s && typeof s === 'object' && 'swmWorld' in s ? s.swmWorld : undefined,
      ua: ua ? [ua.isActive, ua.hasBeenActive] : undefined,
      uav: extra.uav,
      note: extra.note,
    });
    try {
      ss.setItem(ROWS_KEY, JSON.stringify(rows));
    } catch {
      /* storage full — the on-screen copy still updates */
    }
    render();
  };

  for (const k of ['pushState', 'replaceState']) {
    const orig = window.history[k].bind(window.history);
    window.history[k] = (state, title, url) => {
      const r = orig(state, title, url);
      log(k === 'pushState' ? 'PUSH' : 'REPL', { url });
      return r;
    };
  }
  window.addEventListener('popstate', (e) => log('POP', { uav: !!e.hasUAVisualTransition }));
  window.addEventListener('pageshow', (e) => log('SHOW', { note: e.persisted ? 'bfcache' : 'load' }));
  document.addEventListener('astro:before-preparation', (e) => log('PREP', { url: e.to?.href, note: e.navigationType }));
  document.addEventListener('astro:after-swap', () => {
    log('SWAP');
    mount(); // the swap replaced <body>'s children
  });

  let box = null;
  const mount = () => {
    if (!box) {
      box = document.createElement('div');
      box.setAttribute('data-histlog', '');
      box.style.cssText =
        'position:fixed;left:4px;bottom:4px;z-index:2147483647;max-width:calc(100vw - 8px);max-height:45vh;overflow:auto;' +
        'padding:4px 6px;background:rgba(0,0,0,.82);color:#9f9;font:10px/1.3 ui-monospace,Menlo,monospace;' +
        'white-space:pre;border-radius:4px;-webkit-user-select:text;user-select:text';
      box.addEventListener('dblclick', () => {
        rows = [];
        ss.removeItem(ROWS_KEY);
        render();
      });
    }
    if (!box.isConnected) document.body.appendChild(box);
    render();
  };
  const render = () => {
    if (!box) return;
    box.textContent = `histlog (dbl-tap clears) ${window.location.pathname}\n` + rows.map(formatRow).join('\n');
    box.scrollTop = box.scrollHeight;
  };
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });
}

if (typeof window !== 'undefined') {
  try {
    const q = flag('histlog');
    if (q === '1') window.sessionStorage.setItem(ON_KEY, '1');
    if (q === '0') window.sessionStorage.removeItem(ON_KEY);
    if (window.sessionStorage.getItem(ON_KEY) === '1') install();
  } catch {
    /* storage unavailable — no log */
  }
}
