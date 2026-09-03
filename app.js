/* Synth Overview — local dashboard. Data lives in data/synths.json. */

// Keeps the first-time view from opening on the €2000+ flagships, and from
// mixing in sequencers/effects boxes. Only applied when there's no saved
// filter state yet — once someone changes it, that choice persists instead.
const DEFAULT_MAX_PRICE = 300;
const DEFAULT_CATEGORY = ['synth'];

const state = {
  all: [],
  q: '',
  category: new Set(DEFAULT_CATEGORY),
  brand: new Set(),
  form: new Set(),
  poly: new Set(),
  feat: new Set(),
  minPrice: null,
  maxPrice: null,
  sort: 'brand',
  view: 'grid',
  scope: 'all', // 'all' | 'collection' | 'wishlist' — not persisted, always opens on "All"
  collection: new Set(),
  wishlist: new Set(),
};

const $ = (sel) => document.querySelector(sel);
const euro = (n) => (typeof n === 'number' ? '€' + n.toLocaleString('nl-NL') : '—');

/* ---------- persistence ---------- */
// Filters survive a refresh via localStorage, scoped to this page only.
const STORAGE_KEY = 'synth-overview:filters';

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Collection ("I own this") and wishlist ("I want this") are separate,
// per-browser sets of synth ids — independent of the search/filter state
// above so they survive filter resets.
const COLLECTION_KEY = 'synth-overview:collection';
const WISHLIST_KEY = 'synth-overview:wishlist';

function loadIdSet(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveIdSet(key, set) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    // storage unavailable (private mode, quota) — membership just won't persist
  }
}

function toggleMembership(key, set, id) {
  set.has(id) ? set.delete(id) : set.add(id);
  saveIdSet(key, set);
}

function savePersisted() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      q: state.q,
      category: [...state.category],
      brand: [...state.brand],
      form: [...state.form],
      poly: [...state.poly],
      feat: [...state.feat],
      minPrice: state.minPrice,
      maxPrice: state.maxPrice,
      sort: state.sort,
      view: state.view,
    }));
  } catch {
    // storage unavailable (private mode, quota) — filters just won't persist
  }
}

/* ---------- images ---------- */
// Each entry may set "image" (e.g. "images/korg-ms20-mini.jpg"). Without one we
// draw a generated placeholder, so the grid never shows a broken thumbnail and
// we don't fire a 404 per model on every render.
function placeholder(s) {
  const initials = s.brand.slice(0, 12);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">
    <rect width="320" height="200" fill="#2a2a30"/>
    <g fill="#5b5b66" font-family="sans-serif">
      <text x="16" y="34" font-size="14" letter-spacing="2">${esc(initials.toUpperCase())}</text>
      <text x="16" y="180" font-size="11">no image</text>
    </g>
    <text x="16" y="112" fill="#8d8d99" font-family="sans-serif" font-size="22" font-weight="600">${esc(s.name.slice(0, 22))}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function imgTag(s, cls) {
  const fallback = placeholder(s);
  return `<img class="${cls}" loading="lazy" alt="${esc(s.brand + ' ' + s.name)}"
    src="${esc(s.image || fallback)}"
    onerror="this.onerror=null;this.src='${fallback}'">`;
}

const esc = (v) => String(v).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- derived predicates ---------- */
const isNone = (v) => !v || /^(none|n\/a)$/i.test(String(v).trim());

function polyClass(s) {
  const p = (s.polyphony || '').toLowerCase();
  if (p.includes('para')) return 'para';
  if (p.includes('mono')) return 'mono';
  return 'poly';
}

const featureTests = {
  seq: (s) => !isNone(s.seq),
  arp: (s) => !!s.arp,
  fx: (s) => !isNone(s.fx),
  din: (s) => /din/i.test(s.midi || ''),
  usb: (s) => !!s.usb,
  cv: (s) => !isNone(s.cv),
  batt: (s) => /usb|batter|aa\b/i.test(s.power || ''),
  presets: (s) => (typeof s.presets === 'number' ? s.presets > 0 : !!s.presets),
  keys: (s) => !isNone(s.keys) && !/^step buttons$|^buttons$/i.test(s.keys),
};

function haystack(s) {
  return Object.values(s).join(' ').toLowerCase();
}

/* ---------- filtering ---------- */
function filtered() {
  let out = state.all.filter((s) => {
    if (state.scope === 'collection' && !state.collection.has(s.id)) return false;
    if (state.scope === 'wishlist' && !state.wishlist.has(s.id)) return false;
    if (state.q && !haystack(s).includes(state.q)) return false;
    if (state.category.size && !state.category.has(s.category)) return false;
    if (state.brand.size && !state.brand.has(s.brand)) return false;
    if (state.form.size && !state.form.has(s.form)) return false;
    if (state.poly.size && !state.poly.has(polyClass(s))) return false;
    if (typeof s.price_eur === 'number') {
      if (state.minPrice != null && s.price_eur < state.minPrice) return false;
      if (state.maxPrice != null && s.price_eur > state.maxPrice) return false;
    }
    for (const f of state.feat) if (!featureTests[f](s)) return false;
    return true;
  });

  const byBrand = (a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name);
  const cmp = {
    'brand': byBrand,
    'price-asc': (a, b) => (a.price_eur ?? 1e9) - (b.price_eur ?? 1e9),
    'price-desc': (a, b) => (b.price_eur ?? -1) - (a.price_eur ?? -1),
    'voices-desc': (a, b) => (b.voices ?? 0) - (a.voices ?? 0) || byBrand(a, b),
    'year-desc': (a, b) => (b.year ?? 0) - (a.year ?? 0),
    'year-asc': (a, b) => (a.year ?? 9999) - (b.year ?? 9999),
  }[state.sort];

  return out.sort(cmp);
}

/* ---------- rendering ---------- */
const CATEGORY_LABEL = { drum: 'Drum machine', sequencer: 'Sequencer / controller', effects: 'Effects' };

function tags(s) {
  const t = [];
  if (CATEGORY_LABEL[s.category]) t.push([CATEGORY_LABEL[s.category], true]);
  if (!isNone(s.seq)) t.push(['seq', true]);
  if (s.arp) t.push(['arp', false]);
  if (/din/i.test(s.midi || '')) t.push(['MIDI DIN', false]);
  if (!isNone(s.cv)) t.push(['CV', false]);
  if (featureTests.batt(s)) t.push(['batt/USB', false]);
  if (!isNone(s.fx)) t.push(['FX', false]);
  return t.map(([label, hi]) => `<span class="tag${hi ? ' hi' : ''}">${esc(label)}</span>`).join('');
}

function renderGrid(list) {
  $('#grid').innerHTML = list.map((s) => `
    <article class="card" data-id="${esc(s.id)}">
      ${imgTag(s, 'thumb')}
      <div class="body">
        <div>
          <div class="brand">${esc(s.brand)} &middot; ${esc(s.form)}</div>
          <div class="name">${esc(s.name)}</div>
        </div>
        <div class="row">
          <span class="specline">${esc(s.polyphony)} &middot; ${esc(s.type)}</span>
          <span class="price">${euro(s.price_eur)}</span>
        </div>
        <div class="tags">${tags(s)}</div>
      </div>
    </article>`).join('');
}

const COLS = [
  ['', (s) => imgTag(s, 'tinythumb')],
  ['Brand', (s) => esc(s.brand)],
  ['Model', (s) => `<strong>${esc(s.name)}</strong>`],
  ['Price', (s) => euro(s.price_eur), 'num'],
  ['Form', (s) => esc(s.form)],
  ['Engine', (s) => esc(s.type)],
  ['Voices', (s) => (s.voices ?? '—'), 'num'],
  ['Voicing', (s) => esc(s.polyphony)],
  ['Keys', (s) => esc(s.keys)],
  ['Sequencer', (s) => esc(s.seq)],
  ['Arp', (s) => (s.arp ? 'yes' : '—')],
  ['FX', (s) => esc(s.fx)],
  ['MIDI', (s) => esc(s.midi)],
  ['USB', (s) => (s.usb ? 'yes' : '—')],
  ['CV', (s) => esc(s.cv)],
  ['Audio I/O', (s) => esc(s.audio)],
  ['Power', (s) => esc(s.power)],
  ['Presets', (s) => esc(s.presets)],
  ['Year', (s) => (s.year ?? '—'), 'num'],
];

function renderTable(list) {
  $('#table').innerHTML = `<table>
    <thead><tr>${COLS.map(([h, , c]) => `<th class="${c || ''}">${h}</th>`).join('')}</tr></thead>
    <tbody>${list.map((s) => `<tr data-id="${esc(s.id)}">${
      COLS.map(([, fn, c]) => `<td class="${c || ''}">${fn(s)}</td>`).join('')
    }</tr>`).join('')}</tbody>
  </table>`;
}

function render() {
  const list = filtered();
  $('#count').textContent = `${list.length} of ${state.all.length} models`;
  const prices = list.map((s) => s.price_eur).filter((n) => typeof n === 'number');
  $('#pricestats').textContent = prices.length
    ? `${euro(Math.min(...prices))} – ${euro(Math.max(...prices))}` : '';

  $('#empty').hidden = list.length > 0;
  if (!list.length) {
    $('#empty').textContent = state.scope === 'collection'
      ? 'Your collection is empty — open a synth and add it from the popup.'
      : state.scope === 'wishlist'
      ? 'Your wishlist is empty — open a synth and add it from the popup.'
      : 'Nothing matches these filters.';
  }
  $('#grid').hidden = state.view !== 'grid';
  $('#table').hidden = state.view !== 'table';
  // only build the visible view; clear the other so it holds no stale markup
  if (state.view === 'grid') { renderGrid(list); $('#table').innerHTML = ''; }
  else { renderTable(list); $('#grid').innerHTML = ''; }

  savePersisted();
}

/* ---------- detail dialog ---------- */
function openDetail(id) {
  const s = state.all.find((x) => x.id === id);
  if (!s) return;
  const rows = [
    ['Engine', s.type], ['Voices', s.voices], ['Voicing', s.polyphony],
    ['Keys / control', s.keys], ['Sequencer', s.seq], ['Arpeggiator', s.arp ? 'yes' : 'no'],
    ['Effects', s.fx], ['MIDI', s.midi], ['USB', s.usb ? 'yes' : 'no'],
    ['CV / sync', s.cv], ['Audio I/O', s.audio], ['Power', s.power],
    ['Presets', s.presets], ['Multitimbral', s.multitimbral ? 'yes' : 'no'],
    ['Form factor', s.form], ['Released', s.year],
  ];
  const inCollection = state.collection.has(s.id);
  const inWishlist = state.wishlist.has(s.id);
  $('#detail').innerHTML = `
    <div class="dhead">
      ${imgTag(s, '')}
      <div>
        <div class="brand muted">${esc(s.brand)} &middot; ${esc(s.family)}</div>
        <h2>${esc(s.name)}</h2>
        <div class="price" style="color:var(--accent);font-weight:600">${euro(s.price_eur)}</div>
      </div>
    </div>
    <div class="dbody"><dl>${rows.map(([k, v]) =>
      `<dt>${esc(k)}</dt><dd>${esc(v ?? '—')}</dd>`).join('')}</dl></div>
    <div class="dfoot">
      <a href="${esc(s.url)}" target="_blank" rel="noopener">Manufacturer page &nearr;</a>
      <div class="dactions">
        <button type="button" class="collect-btn${inCollection ? ' on' : ''}" data-id="${esc(s.id)}">${inCollection ? '✓ In collection' : '+ Add to collection'}</button>
        <button type="button" class="wishlist-btn${inWishlist ? ' on' : ''}" data-id="${esc(s.id)}">${inWishlist ? '★ In wishlist' : '☆ Add to wishlist'}</button>
        <button value="close">Close</button>
      </div>
    </div>`;
  $('#detail').showModal();
}

function refreshDetailActions(id) {
  const cb = $('#detail .collect-btn');
  const wb = $('#detail .wishlist-btn');
  if (cb && cb.dataset.id === id) {
    const on = state.collection.has(id);
    cb.classList.toggle('on', on);
    cb.textContent = on ? '✓ In collection' : '+ Add to collection';
  }
  if (wb && wb.dataset.id === id) {
    const on = state.wishlist.has(id);
    wb.classList.toggle('on', on);
    wb.textContent = on ? '★ In wishlist' : '☆ Add to wishlist';
  }
}

/* ---------- wiring ---------- */
// Builds the button list when `values` is given (brand/form, data-driven);
// otherwise syncs the .on class on the static buttons already in the HTML
// (voicing/must-have) to whatever is in state[key].
function chipGroup(el, key, values) {
  if (values) {
    el.innerHTML = values.map((v) =>
      `<button data-val="${esc(v)}" class="${state[key].has(v) ? 'on' : ''}">${esc(v)}</button>`).join('');
  } else {
    el.querySelectorAll('button').forEach((b) => b.classList.toggle('on', state[key].has(b.dataset.val)));
  }
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const v = b.dataset.val;
    state[key].has(v) ? state[key].delete(v) : state[key].add(v);
    b.classList.toggle('on');
    render();
  });
}

// Restore a saved filter set, dropping any brand/form values that no longer
// exist in data/synths.json (e.g. after edits) so a stale filter can't hide
// everything silently.
function applyPersisted(saved, knownBrand, knownForm) {
  if (!saved) return;
  state.q = typeof saved.q === 'string' ? saved.q : '';
  // saved.category absent means this was written before categories existed —
  // migrate those to the synth-only default rather than showing everything.
  state.category = new Set(saved.category !== undefined ? saved.category : DEFAULT_CATEGORY);
  state.brand = new Set((saved.brand || []).filter((v) => knownBrand.includes(v)));
  state.form = new Set((saved.form || []).filter((v) => knownForm.includes(v)));
  state.poly = new Set(saved.poly || []);
  state.feat = new Set(saved.feat || []);
  state.minPrice = typeof saved.minPrice === 'number' ? saved.minPrice : null;
  state.maxPrice = typeof saved.maxPrice === 'number' ? saved.maxPrice : null;
  state.sort = saved.sort || 'brand';
  state.view = saved.view === 'table' ? 'table' : 'grid';
}

function wire() {
  state.collection = loadIdSet(COLLECTION_KEY);
  state.wishlist = loadIdSet(WISHLIST_KEY);

  const uniq = (k) => [...new Set(state.all.map((s) => s[k]))].sort();
  const brands = uniq('brand');
  const forms = uniq('form');

  const saved = loadPersisted();
  if (saved) applyPersisted(saved, brands, forms);
  else state.maxPrice = DEFAULT_MAX_PRICE;

  chipGroup($('#f-category'), 'category');
  chipGroup($('#f-brand'), 'brand', brands);
  chipGroup($('#f-form'), 'form', forms);
  chipGroup($('#f-poly'), 'poly');
  chipGroup($('#f-feat'), 'feat');

  const maxP = Math.ceil(Math.max(...state.all.map((s) => s.price_eur || 0)) / 10) * 10;
  const priceMin = $('#f-price-min');
  const priceMax = $('#f-price-max');
  priceMin.placeholder = '0';
  priceMax.placeholder = String(maxP);
  if (state.minPrice != null) priceMin.value = state.minPrice;
  if (state.maxPrice != null) priceMax.value = state.maxPrice;

  const syncPrice = () => {
    const minV = priceMin.value === '' ? null : Math.max(0, +priceMin.value);
    const maxV = priceMax.value === '' ? null : +priceMax.value;
    state.minPrice = minV;
    state.maxPrice = maxV;
    $('#pricelabel').textContent = (minV != null || maxV != null)
      ? `(${minV != null ? euro(minV) : euro(0)} – ${maxV != null ? euro(maxV) : 'any'})` : '';
  };
  syncPrice();
  priceMin.addEventListener('input', () => { syncPrice(); render(); });
  priceMax.addEventListener('input', () => { syncPrice(); render(); });

  $('#q').value = state.q;
  $('#q').addEventListener('input', (e) => { state.q = e.target.value.trim().toLowerCase(); render(); });

  $('#sort').value = state.sort;
  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });

  document.querySelectorAll('.viewtoggle button').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === state.view);
    b.addEventListener('click', () => {
      document.querySelectorAll('.viewtoggle button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      state.view = b.dataset.view;
      render();
    });
  });

  $('#reset').addEventListener('click', () => {
    ['brand', 'form', 'poly', 'feat'].forEach((k) => state[k].clear());
    state.category = new Set(DEFAULT_CATEGORY);
    document.querySelectorAll('.chips button.on').forEach((b) => b.classList.remove('on'));
    document.querySelectorAll('#f-category button').forEach((b) =>
      b.classList.toggle('on', state.category.has(b.dataset.val)));
    state.q = ''; $('#q').value = '';
    state.sort = 'brand'; $('#sort').value = 'brand';
    priceMin.value = ''; priceMax.value = DEFAULT_MAX_PRICE; syncPrice();
    render();
  });

  document.addEventListener('click', (e) => {
    const hit = e.target.closest('.card, tbody tr');
    if (hit) { openDetail(hit.dataset.id); return; }

    const collectBtn = e.target.closest('.collect-btn');
    if (collectBtn) {
      const id = collectBtn.dataset.id;
      toggleMembership(COLLECTION_KEY, state.collection, id);
      refreshDetailActions(id);
      updateScopeToggle();
      if (state.scope === 'collection') render();
      return;
    }

    const wishBtn = e.target.closest('.wishlist-btn');
    if (wishBtn) {
      const id = wishBtn.dataset.id;
      toggleMembership(WISHLIST_KEY, state.wishlist, id);
      refreshDetailActions(id);
      updateScopeToggle();
      if (state.scope === 'wishlist') render();
      return;
    }

    if (e.target.matches('.dfoot button[value="close"]')) $('#detail').close();
  });

  document.querySelectorAll('.scopetoggle button').forEach((b) => {
    b.addEventListener('click', () => {
      state.scope = b.dataset.scope;
      updateScopeToggle();
      render();
    });
  });
  updateScopeToggle();

  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== $('#q')) { e.preventDefault(); $('#q').focus(); }
    if (e.key === 'Escape') closeFilters();
  });

  wireMobileFilters();
}

function updateScopeToggle() {
  const labels = { all: 'All', collection: 'Collection', wishlist: 'Wishlist' };
  document.querySelectorAll('.scopetoggle button').forEach((b) => {
    const scope = b.dataset.scope;
    b.classList.toggle('active', scope === state.scope);
    const count = scope === 'collection' ? state.collection.size
      : scope === 'wishlist' ? state.wishlist.size : null;
    b.textContent = count != null ? `${labels[scope]} (${count})` : labels[scope];
  });
}

/* ---------- mobile filter drawer ---------- */
// Below the 860px breakpoint the sidebar becomes an off-canvas drawer opened
// by the "Filters" pill in the top bar; above it these calls are inert.
function openFilters() {
  $('#filters').classList.add('open');
  $('#filterbackdrop').hidden = false;
  $('#filtertoggle').setAttribute('aria-expanded', 'true');
}
function closeFilters() {
  $('#filters').classList.remove('open');
  $('#filterbackdrop').hidden = true;
  $('#filtertoggle').setAttribute('aria-expanded', 'false');
}
function activeFilterCount() {
  return state.brand.size + state.form.size + state.poly.size + state.feat.size
    + (state.minPrice != null ? 1 : 0) + (state.maxPrice != null && state.maxPrice !== DEFAULT_MAX_PRICE ? 1 : 0);
}
function updateFilterBadge() {
  const n = activeFilterCount();
  const badge = $('#filtercount');
  badge.hidden = n === 0;
  badge.textContent = n;
  $('#filtertoggle').classList.toggle('has-active', n > 0);
}
function wireMobileFilters() {
  $('#filtertoggle').addEventListener('click', openFilters);
  $('#filterclose').addEventListener('click', closeFilters);
  $('#filterbackdrop').addEventListener('click', closeFilters);
  // any filter interaction updates the badge; cheapest hook is a delegated
  // listener on <main> that fires after the chip/price/reset handlers run
  document.querySelector('main').addEventListener('click', updateFilterBadge);
  $('#f-price-min').addEventListener('input', updateFilterBadge);
  $('#f-price-max').addEventListener('input', updateFilterBadge);
  updateFilterBadge();
}

/* ---------- boot ---------- */
fetch('data/synths.json')
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then((data) => { state.all = data; wire(); render(); })
  .catch((err) => {
    $('#grid').innerHTML = `<p class="empty">Could not load <code>data/synths.json</code> (${esc(err.message)}).<br>
      Opening index.html directly from disk blocks fetch — start a local server and browse to it:<br>
      <code>python -m http.server 8000</code></p>`;
  });
