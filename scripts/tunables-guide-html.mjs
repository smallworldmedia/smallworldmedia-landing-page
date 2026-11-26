// docs/tunables-guide.md -> a navigable single-file HTML page (the artifact version).
// usage: node scripts/tunables-guide-html.mjs docs/tunables-guide.md /tmp/swm-tunables-guide.html Minimal md subset: h1-h3, p, ul/ol, tables, fenced code, `code`, **bold**, *em*.
import { readFileSync, writeFileSync } from 'node:fs';
const [,, mdPath, outPath] = process.argv;
const md = readFileSync(mdPath, 'utf8').split('\n');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const slug = (s) => s.replace(/`/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const inline = (raw, inCell = false) => {
  let s = esc(raw);
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(])\*([^*]+)\*(?=[\s.,;:)]|$)/g, '$1<em>$2</em>');
  const badge = { dead: 'dead', unreachable: 'dead', 'never fires': 'dead', live: 'live', 'legacy alias': 'legacy', tabled: 'legacy', 'no clamp': 'warn', present: 'warn', 'rebuilt from pathname': 'warn' };
  s = s.replace(/<strong>([^<]+)<\/strong>/g, (m, t) => badge[t] ? `<span class="badge badge-${badge[t]}">${t}</span>` : m);
  if (inCell) s = s.replace(/\[(all|DRUM|ATLAS|FORME|legacy|grid)\]/g, (_, t) => `<span class="chip chip-${t.toLowerCase()}">${t}</span>`);
  return s;
};
const splitRow = (line) => line.replace(/^\|/, '').replace(/\|\s*$/, '').split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim());

let title = '', lede = '';
const nav = []; // {id, text, subs:[{id,text}]}
let out = [];
let secOpen = false, subOpen = false, i = 0;
const closeSub = () => { if (subOpen) { out.push('</div>'); subOpen = false; } };
const closeSec = () => { closeSub(); if (secOpen) { out.push('</section>'); secOpen = false; } };
let sawH2 = false;
while (i < md.length) {
  const line = md[i];
  if (/^```/.test(line)) { const buf = []; i++; while (i < md.length && !/^```/.test(md[i])) buf.push(md[i++]); i++; out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`); continue; }
  let m;
  if ((m = line.match(/^# (.+)/))) { title = m[1]; i++; continue; }
  if ((m = line.match(/^## (.+)/))) { closeSec(); const id = slug(m[1]); nav.push({ id, text: inline(m[1]), subs: [] }); out.push(`<section class="sec" id="${id}"><h2>${inline(m[1])}</h2>`); secOpen = true; sawH2 = true; i++; continue; }
  if ((m = line.match(/^### (.+)/))) { closeSub(); const id = slug(m[1]); nav[nav.length - 1].subs.push({ id, text: inline(m[1]) }); out.push(`<div class="sub" id="${id}"><h3>${inline(m[1])}</h3>`); subOpen = true; i++; continue; }
  if (/^\|/.test(line)) {
    const rows = []; while (i < md.length && /^\|/.test(md[i])) rows.push(md[i++]);
    const head = splitRow(rows[0]); const body = rows.slice(2).map(splitRow);
    const cols = head.length;
    let t = `<div class="tbl"><table><thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>`;
    for (const r of body) {
      const cells = r.map((c, k) => inline(c, true));
      const cls = [cells.some((c) => c.includes('badge-dead')) ? 'row-dead' : '', cells.some((c) => c.includes('chip-legacy')) ? 'row-inert' : ''].filter(Boolean).join(' ');
      t += `<tr${cls ? ` class="${cls}"` : ''}>${cells.map((c, k) => `<td${k === 0 ? ' class="key"' : ''}>${c}</td>`).join('')}</tr>`;
    }
    out.push(t + '</tbody></table></div>'); continue;
  }
  if (/^- /.test(line)) { const items = []; while (i < md.length && /^- /.test(md[i])) items.push(md[i++].slice(2)); out.push(`<ul>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`); continue; }
  if (/^\d+\. /.test(line)) { const items = []; while (i < md.length && /^\d+\. /.test(md[i])) items.push(md[i++].replace(/^\d+\. /, '')); out.push(`<ol>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</ol>`); continue; }
  if (line.trim() === '') { i++; continue; }
  const buf = []; while (i < md.length && md[i].trim() !== '' && !/^(#|\||- |\d+\. |```)/.test(md[i])) buf.push(md[i++]);
  const p = buf.join(' ');
  if (!sawH2 && !lede) { lede = inline(p); continue; }
  out.push(`<p>${inline(p)}</p>`);
}
closeSec();

const navHtml = nav.map((n) => `<li><a href="#${n.id}" data-sec="${n.id}">${n.text}<span class="cnt"></span></a>${n.subs.length ? `<ul>${n.subs.map((s) => `<li><a href="#${s.id}" data-sec="${s.id}">${s.text}<span class="cnt"></span></a></li>`).join('')}</ul>` : ''}</li>`).join('');

const html = `<title>${esc(title.replace('Tunables & Debug Guide', 'SWM Tunables Guide'))}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Sans+Condensed:wght@600&display=swap">
<style>
:root{
  --bg:#fafafa; --surface:#ffffff; --surface-2:#f1f2f6; --ink:#0a0a0a; --ink-2:#404040; --ink-3:#6b6f7a;
  --line:#d9dbe3; --line-2:#e8e9ef; --accent:#0000ff; --accent-ink:#0000ff; --accent-soft:#e9e9ff;
  --dead:#b3261e; --dead-soft:#fbe9e7; --live:#1b7f3b; --live-soft:#e3f3e8; --warn:#8a5a00; --warn-soft:#fff2d6; --inert:#6b6f7a; --inert-soft:#eceef2;
  --chip-all:#e9e9ff; --chip-drum:#e3f3e8; --chip-atlas:#fff2d6; --chip-forme:#f3e6f7; --chip-legacy:#eceef2; --chip-grid:#e3f0fb;
  --mono:'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace; --sans:'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif; --cond:'IBM Plex Sans Condensed', 'IBM Plex Sans', system-ui, sans-serif;
  --nav-w:16.5rem; --shadow:0 1px 0 var(--line);
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  --bg:#0a0a0a; --surface:#121212; --surface-2:#1a1a1d; --ink:#ececf0; --ink-2:#b8bac2; --ink-3:#8a8d97;
  --line:#26272e; --line-2:#1e1f25; --accent:#7a7aff; --accent-ink:#9a9aff; --accent-soft:#1a1a3a;
  --dead:#ff7b70; --dead-soft:#3a1714; --live:#5fd08a; --live-soft:#123320; --warn:#f0c060; --warn-soft:#3a2a08; --inert:#9a9da8; --inert-soft:#222329;
  --chip-all:#1a1a3a; --chip-drum:#123320; --chip-atlas:#3a2a08; --chip-forme:#2e1a36; --chip-legacy:#222329; --chip-grid:#0f2436;
}}
:root[data-theme="dark"]{
  --bg:#0a0a0a; --surface:#121212; --surface-2:#1a1a1d; --ink:#ececf0; --ink-2:#b8bac2; --ink-3:#8a8d97;
  --line:#26272e; --line-2:#1e1f25; --accent:#7a7aff; --accent-ink:#9a9aff; --accent-soft:#1a1a3a;
  --dead:#ff7b70; --dead-soft:#3a1714; --live:#5fd08a; --live-soft:#123320; --warn:#f0c060; --warn-soft:#3a2a08; --inert:#9a9da8; --inert-soft:#222329;
  --chip-all:#1a1a3a; --chip-drum:#123320; --chip-atlas:#3a2a08; --chip-forme:#2e1a36; --chip-legacy:#222329; --chip-grid:#0f2436;
}
*{box-sizing:border-box}
html{scroll-padding-top:4.5rem}
@media (prefers-reduced-motion: no-preference){ html{scroll-behavior:smooth} }
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 var(--sans);-webkit-font-smoothing:antialiased}
a{color:var(--accent-ink);text-decoration:none}
a:hover{text-decoration:underline}
code{font-family:var(--mono);font-size:.86em;background:var(--surface-2);border:1px solid var(--line-2);border-radius:3px;padding:.05em .35em;white-space:nowrap}
pre{background:var(--surface-2);border:1px solid var(--line);border-radius:4px;padding:.9rem 1rem;overflow-x:auto;font:13px/1.5 var(--mono)}
pre code{background:none;border:0;padding:0;white-space:pre;font-size:inherit}
strong{font-weight:600}
h1,h2,h3{text-wrap:balance;margin:0}
.layout{display:grid;grid-template-columns:var(--nav-w) minmax(0,1fr);min-height:100vh}
/* sidebar */
.side{position:sticky;top:0;height:100vh;overflow-y:auto;border-right:1px solid var(--line);background:var(--surface);display:flex;flex-direction:column;gap:.75rem;padding:1rem .9rem 2rem}
.brand{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
.brand b{display:block;font:600 15px/1.2 var(--cond);letter-spacing:0;text-transform:none;color:var(--ink);margin-top:.15rem}
.search{position:relative}
.search input{width:100%;font:13px/1.2 var(--mono);color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:4px;padding:.55rem .6rem .55rem 1.9rem;outline:none}
.search input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.search svg{position:absolute;left:.55rem;top:50%;transform:translateY(-50%);width:14px;height:14px;color:var(--ink-3)}
.search kbd{position:absolute;right:.5rem;top:50%;transform:translateY(-50%);font:11px var(--mono);color:var(--ink-3);border:1px solid var(--line);border-radius:3px;padding:0 .3rem;background:var(--surface)}
.hits{font:11px/1.4 var(--mono);color:var(--ink-3);min-height:1.2em;padding-left:.1rem}
.hits:empty{display:none}
nav ul{list-style:none;margin:0;padding:0}
nav>ul>li{margin:.15rem 0}
nav a{display:flex;justify-content:space-between;gap:.5rem;align-items:baseline;font:13px/1.35 var(--sans);color:var(--ink-2);padding:.28rem .5rem;border-radius:3px;border-left:2px solid transparent}
nav a code{font-size:.85em;background:none;border:0;padding:0;color:inherit}
nav ul ul a{font-size:12px;padding-left:1.1rem;color:var(--ink-3)}
nav a:hover{background:var(--surface-2);color:var(--ink);text-decoration:none}
nav a.active{color:var(--accent-ink);border-left-color:var(--accent);background:var(--accent-soft)}
nav .cnt{font:11px var(--mono);color:var(--ink-3)}
nav .cnt:empty{display:none}
/* main */
main{padding:0 3rem 6rem;max-width:80rem}
.masthead{padding:2.25rem 0 1.5rem;border-bottom:1px solid var(--line);margin-bottom:.5rem}
.masthead .eyebrow{font:500 11px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--accent-ink);margin-bottom:.9rem}
h1{font:600 clamp(28px,3.4vw,40px)/1.05 var(--cond);letter-spacing:-.01em}
.lede{max-width:64ch;color:var(--ink-2);margin:.9rem 0 0;font-size:15px}
.stats{display:flex;flex-wrap:wrap;gap:1.6rem;margin-top:1.1rem;font:12px/1.3 var(--mono);color:var(--ink-3)}
.stats b{display:block;font:600 22px/1.1 var(--cond);color:var(--ink);font-variant-numeric:tabular-nums}
.sec{padding:2rem 0 .5rem;border-top:1px solid var(--line-2)}
.sec:first-of-type{border-top:0}
h2{font:600 24px/1.15 var(--cond);letter-spacing:-.005em;margin:0 0 .9rem}
h2 code{font-size:.75em;vertical-align:.08em;color:var(--accent-ink);background:var(--accent-soft);border-color:transparent}
h3{font:600 15px/1.3 var(--sans);margin:1.5rem 0 .6rem;color:var(--ink)}
h3 code{font-size:.85em}
.sec>p,.sub>p{max-width:72ch;margin:.55rem 0;color:var(--ink-2)}
.sec>p strong,.sub>p strong{color:var(--ink)}
ul,ol{max-width:76ch;padding-left:1.3rem;margin:.6rem 0;color:var(--ink-2)}
li{margin:.3rem 0}
li strong{color:var(--ink)}
/* tables */
.tbl{overflow-x:auto;border:1px solid var(--line);border-radius:4px;background:var(--surface);margin:.6rem 0 1rem;max-height:none}
table{border-collapse:collapse;width:100%;font-size:13.5px;line-height:1.45}
th{position:sticky;top:0;z-index:1;background:var(--surface-2);text-align:left;font:500 11px/1.2 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);padding:.55rem .7rem;border-bottom:1px solid var(--line);white-space:nowrap}
td{vertical-align:top;padding:.5rem .7rem;border-top:1px solid var(--line-2);color:var(--ink-2)}
tr:first-child td{border-top:0}
td.key{white-space:nowrap;font-family:var(--mono);font-size:13px;color:var(--ink)}
td.key code{background:none;border:0;padding:0;font-size:inherit;color:var(--accent-ink);font-weight:500}
td:nth-child(2){min-width:20rem}
td:nth-child(3){min-width:8rem;font-variant-numeric:tabular-nums}
td:nth-child(3) code,td:nth-child(4) code,td:nth-child(5) code{white-space:normal}
tr.row-dead td.key code{color:var(--dead)}
tr.row-inert td{color:var(--ink-3)}
tr.row-inert td.key code{color:var(--inert)}
tr:hover td{background:var(--surface-2)}
tbody tr[hidden]{display:none}
.chip,.badge{display:inline-block;font:500 10.5px/1.5 var(--mono);letter-spacing:.04em;border-radius:3px;padding:0 .4em;vertical-align:.1em;white-space:nowrap}
.chip{background:var(--chip-all);color:var(--ink-2);margin-left:.15em}
.chip-drum{background:var(--chip-drum)} .chip-atlas{background:var(--chip-atlas)} .chip-forme{background:var(--chip-forme)} .chip-legacy{background:var(--chip-legacy);color:var(--inert)} .chip-grid{background:var(--chip-grid)}
.badge{text-transform:uppercase;font-weight:600}
.badge-dead{background:var(--dead-soft);color:var(--dead)} .badge-live{background:var(--live-soft);color:var(--live)} .badge-legacy{background:var(--inert-soft);color:var(--inert)} .badge-warn{background:var(--warn-soft);color:var(--warn)}
/* filtering state */
body.filtering main .sec:not(.has-match),body.filtering main .sub:not(.has-match){display:none}
body.filtering main p,body.filtering main ul,body.filtering main ol,body.filtering main pre{display:none}
body.filtering main .tbl.empty{display:none}
body.filtering .masthead .lede,body.filtering .masthead .stats{display:none}
.empty-state{display:none;font:13px var(--mono);color:var(--ink-3);padding:2rem 0}
body.filtering.no-results .empty-state{display:block}
mark{background:var(--warn-soft);color:inherit;padding:0 .05em}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.totop{position:fixed;right:1rem;bottom:1rem;font:12px var(--mono);background:var(--surface);border:1px solid var(--line);border-radius:4px;padding:.4rem .6rem;color:var(--ink-2)}
@media (max-width:60rem){
  .layout{grid-template-columns:1fr}
  .side{position:static;height:auto;border-right:0;border-bottom:1px solid var(--line)}
  nav{display:none}
  .side.open nav{display:block}
  .navtoggle{display:inline-block;font:12px var(--mono);color:var(--ink-2);background:none;border:1px solid var(--line);border-radius:3px;padding:.3rem .5rem;cursor:pointer;align-self:flex-start}
  main{padding:0 1rem 4rem}
}
@media (min-width:60.01rem){ .navtoggle{display:none} }
</style>
<div class="layout">
<aside class="side" id="side">
  <div class="brand">Small World Media · site<b>Tunables & debug</b></div>
  <div class="search">
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 14 14"/></svg>
    <input id="q" type="search" placeholder="filter rows — ?param, word, file" autocomplete="off" spellcheck="false" aria-label="Filter table rows">
    <kbd>/</kbd>
  </div>
  <div class="hits" id="hits"></div>
  <button class="navtoggle" id="navtoggle" type="button">contents</button>
  <nav aria-label="Sections"><ul>${navHtml}</ul></nav>
</aside>
<main>
  <header class="masthead">
    <div class="eyebrow">feature/v1-launch · 2026-09-01 · docs/tunables-guide.md</div>
    <h1>SWM Tunables Guide</h1>
    <p class="lede">${lede}</p>
    <div class="stats"><div><b>229</b>url params</div><div><b>26</b>reader files</div><div><b>10</b>bench panels</div><div><b>4</b>debug globals</div><div><b>10</b>latent bugs</div></div>
  </header>
  <div class="empty-state">no rows match — try a shorter fragment, e.g. <code>detent</code></div>
  ${out.join('\n')}
</main>
</div>
<a class="totop" href="#top" id="totop" hidden>↑ top</a>
<script>
(function(){
  var q=document.getElementById('q'), hits=document.getElementById('hits'), body=document.body;
  var rows=[].slice.call(document.querySelectorAll('main tbody tr'));
  var secs=[].slice.call(document.querySelectorAll('main .sec, main .sub'));
  var tbls=[].slice.call(document.querySelectorAll('main .tbl'));
  var navLinks=[].slice.call(document.querySelectorAll('nav a'));
  rows.forEach(function(r){ r.dataset.t=r.textContent.toLowerCase(); });
  function apply(){
    var v=q.value.trim().toLowerCase().replace(/^\\?/,'');
    body.classList.toggle('filtering',!!v);
    var total=0;
    rows.forEach(function(r){ var hit=!v||r.dataset.t.indexOf(v)>-1; r.hidden=!hit; if(hit&&v) total++; });
    tbls.forEach(function(t){ t.classList.toggle('empty', v && ![].some.call(t.querySelectorAll('tbody tr'),function(r){return !r.hidden;})); });
    secs.forEach(function(s){ var any=[].some.call(s.querySelectorAll('tbody tr'),function(r){return !r.hidden;}); s.classList.toggle('has-match',!v||any); });
    navLinks.forEach(function(a){ var el=document.getElementById(a.dataset.sec); var c=a.querySelector('.cnt'); if(!el){c.textContent='';return;} var n=v?[].filter.call(el.querySelectorAll('tbody tr'),function(r){return !r.hidden;}).length:0; c.textContent=v&&n?String(n):''; a.parentNode.style.display=(v&&!n)?'none':''; });
    body.classList.toggle('no-results',!!v&&total===0);
    hits.textContent=v?(total+' matching row'+(total===1?'':'s')):'';
    try{ if(v) sessionStorage.setItem('swm-tune-q',v); else sessionStorage.removeItem('swm-tune-q'); }catch(e){}
  }
  q.addEventListener('input',apply);
  document.addEventListener('keydown',function(e){
    if(e.key==='/'&&document.activeElement!==q&&!/input|textarea/i.test(document.activeElement.tagName)){e.preventDefault();q.focus();q.select();}
    if(e.key==='Escape'&&document.activeElement===q){q.value='';apply();q.blur();}
  });
  try{ var saved=sessionStorage.getItem('swm-tune-q'); if(saved){q.value=saved;} }catch(e){}
  apply();
  var toggle=document.getElementById('navtoggle'); if(toggle) toggle.addEventListener('click',function(){document.getElementById('side').classList.toggle('open');});
  // scrollspy
  var h2s=[].slice.call(document.querySelectorAll('main .sec'));
  if('IntersectionObserver' in window){
    var current=null;
    var io=new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if(en.isIntersecting){ current=en.target.id; } });
      navLinks.forEach(function(a){ a.classList.toggle('active',a.dataset.sec===current); });
    },{rootMargin:'-10% 0px -75% 0px',threshold:0});
    h2s.forEach(function(s){ io.observe(s); });
  }
  var totop=document.getElementById('totop');
  window.addEventListener('scroll',function(){ totop.hidden=window.scrollY<600; },{passive:true});
  totop.addEventListener('click',function(e){ e.preventDefault(); window.scrollTo({top:0}); });
})();
</script>`;
writeFileSync(outPath, html);
console.log(`wrote ${outPath} (${html.length} bytes, ${nav.length} sections, ${nav.reduce((a, n) => a + n.subs.length, 0)} subsections)`);
