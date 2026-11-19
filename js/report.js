// The report card: Today / Yesterday / Week.
// Facts only — no judging words. Tiles keep their elements between renders
// so numbers can count up from the old value.

import { get, dayKey, daysAgo, emptyDay } from './store.js';
import { t, num, locale } from './strings.js';
import { countUp } from './effects.js';
import { renderSummary } from './assistant.js';

const $ = (id) => document.getElementById(id);
let view = '0'; // '0' today, '1' yesterday, 'week'
let started = false;
const tiles = new Map();
let openTabs = null;

export async function initReport() {
  if (started) return;
  started = true;
  document.querySelectorAll('#reportModule .seg-btn').forEach((b) => {
    b.addEventListener('click', () => { view = b.dataset.day; render(); });
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.days) render();
  });
  document.addEventListener('intent:lang', render);
  $('aiSummaryRefresh').addEventListener('click', () => {
    if (lastDay) scheduleSummary(lastDay.key, lastDay.d, true);
  });

  // Open tabs right now (no extra permission needed just to count them).
  const countTabs = async () => {
    try { openTabs = (await chrome.tabs.query({})).length; } catch { openTabs = null; }
    if (view === '0') render();
  };
  let tabTimer = 0;
  const later = () => { clearTimeout(tabTimer); tabTimer = setTimeout(countTabs, 300); };
  chrome.tabs?.onCreated?.addListener(later);
  chrome.tabs?.onRemoved?.addListener(later);
  await countTabs();
  render();
}

// The summary waits a moment so a burst of updates (new tab, ticked task) triggers it once.
let summaryTimer = 0;
let lastDay = null;
function scheduleSummary(key, d, force = false) {
  lastDay = { key, d };
  clearTimeout(summaryTimer);
  summaryTimer = setTimeout(() => renderSummary(key, d, { force }), force ? 0 : 600);
}

function tile(key, { wide = false, meter = false } = {}) {
  if (tiles.has(key)) return tiles.get(key);
  const wrap = document.createElement('div');
  wrap.className = 'stat' + (wide ? ' stat-wide' : '');
  const dt = document.createElement('dt');
  const dd = document.createElement('dd');
  wrap.append(dt, dd);
  let fill = null;
  if (meter) {
    const m = document.createElement('div');
    m.className = 'meter';
    m.setAttribute('aria-hidden', 'true');
    fill = document.createElement('div');
    fill.className = 'meter-fill';
    m.append(fill);
    wrap.append(m);
  }
  const t2 = { wrap, dt, dd, fill };
  tiles.set(key, t2);
  return t2;
}

function pctOf(d) {
  return d.tabs ? Math.round((Math.min(d.intentTabs, d.tabs) / d.tabs) * 100) : 0;
}

// Days in a row (ending today, or yesterday if today has none yet) with a finished intent.
function streakOf(days) {
  let n = 0;
  const startAt = (days[dayKey()] || {}).intentsDone ? 0 : 1;
  for (let i = startAt; i < 60; i++) {
    if ((days[dayKey(daysAgo(i))] || {}).intentsDone > 0) n++;
    else break;
  }
  return n;
}

function weekChart(days) {
  const box = document.createElement('div');
  box.className = 'wk-chart';
  const rows = [];
  for (let i = 6; i >= 0; i--) {
    const date = daysAgo(i);
    rows.push({ date, d: { ...emptyDay(), ...(days[dayKey(date)] || {}) }, today: i === 0 });
  }
  const max = Math.max(1, ...rows.map((r) => r.d.tabs));
  const lang = locale();
  for (const r of rows) {
    const col = document.createElement('div');
    col.className = 'wk-col' + (r.today ? ' is-today' : '');
    const name = r.date.toLocaleDateString(lang, { weekday: 'short' });
    const label = t('weekBarTitle', { day: name, tabs: r.d.tabs, intent: Math.min(r.d.intentTabs, r.d.tabs) });
    col.title = label;
    col.setAttribute('aria-label', label);
    const bar = document.createElement('div');
    bar.className = 'wk-bar';
    bar.style.height = Math.max(3, (r.d.tabs / max) * 100) + '%';
    const part = document.createElement('div');
    part.className = 'wk-part';
    part.style.height = (r.d.tabs ? (Math.min(r.d.intentTabs, r.d.tabs) / r.d.tabs) * 100 : 0) + '%';
    bar.append(part);
    const lab = document.createElement('span');
    lab.className = 'wk-label';
    lab.textContent = r.date.toLocaleDateString(lang, { weekday: 'narrow' });
    col.append(bar, lab);
    box.append(col);
  }
  const legend = document.createElement('div');
  legend.className = 'wk-legend';
  legend.innerHTML = '<span class="wk-dot wk-dot-intent"></span>';
  legend.append(t('weekLegendIntent'));
  const l2 = document.createElement('span');
  l2.className = 'wk-dot wk-dot-other';
  legend.append(l2, t('weekLegendOther'));
  return { box, legend };
}

async function render() {
  document.querySelectorAll('#reportModule .seg-btn').forEach((b) => {
    b.setAttribute('aria-selected', String(b.dataset.day === view));
  });
  const { days = {} } = await get('days');
  const box = $('reportStats');
  const order = [];

  if (view === 'week') {
    const agg = emptyDay();
    for (let i = 0; i < 7; i++) {
      const d = days[dayKey(daysAgo(i))] || {};
      for (const k of Object.keys(agg)) agg[k] += d[k] || 0;
    }
    $('reportEmpty').hidden = agg.tabs > 0;
    box.hidden = !agg.tabs;
    scheduleSummary('week', agg);
    if (!agg.tabs) return;

    const chart = tile('wkChart', { wide: true });
    chart.dt.textContent = t('weekTitle');
    const { box: c, legend } = weekChart(days);
    chart.dd.textContent = '';
    chart.dd.append(c, legend);
    order.push(chart);

    const tabs = tile('wkTabs');
    tabs.dt.textContent = t('weekTabs');
    countUp(tabs.dd, agg.tabs, (n) => num(n));
    order.push(tabs);

    const pct = tile('wkPct');
    pct.dt.textContent = t('reportIntentPct');
    countUp(pct.dd, pctOf(agg), (n) => t('pct', { n }));
    order.push(pct);

    const done = tile('wkDone');
    done.dt.textContent = t('reportDone');
    done.dd.textContent = t('reportDoneValue', { done: agg.intentsDone, set: agg.intentsSet });
    order.push(done);

    const st = tile('streak');
    st.dt.textContent = t('streakLabel');
    st.dd.textContent = t('streakValue', { n: streakOf(days) });
    order.push(st);
  } else {
    const off = Number(view);
    const key = dayKey(daysAgo(off));
    const d = { ...emptyDay(), ...(days[key] || {}) };
    $('reportEmpty').hidden = d.tabs > 0;
    box.hidden = !d.tabs;
    scheduleSummary(key, d);
    if (!d.tabs) return;

    const tabs = tile('tabs');
    tabs.dt.textContent = t('reportTabs');
    countUp(tabs.dd, d.tabs, (n) => num(n));
    order.push(tabs);

    const pct = tile('pct', { meter: true });
    pct.dt.textContent = t('reportIntentPct');
    countUp(pct.dd, pctOf(d), (n) => t('pct', { n }));
    pct.fill.style.width = pctOf(d) + '%';
    order.push(pct);

    const done = tile('done');
    done.dt.textContent = t('reportDone');
    done.dd.textContent = t('reportDoneValue', { done: d.intentsDone, set: d.intentsSet });
    order.push(done);

    if (off === 0) {
      const streak = streakOf(days);
      if (openTabs != null || streak >= 2) {
        // Two small tiles side by side.
        if (openTabs != null) {
          const o = tile('open', { wide: false });
          o.wrap.classList.add('stat-half');
          o.dt.textContent = t('openTabsNow');
          countUp(o.dd, openTabs, (n) => num(n));
          order.push(o);
        }
        if (streak >= 2) {
          const s = tile('streakToday');
          s.wrap.classList.add('stat-half');
          s.dt.textContent = t('streakLabelShort');
          s.dd.textContent = t('streakValue', { n: streak });
          order.push(s);
        }
      }
    }
  }

  // Re-attach only the tiles for this view, in order.
  box.textContent = '';
  order.forEach((x) => box.append(x.wrap));
}
