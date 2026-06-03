/* ============================================================
   Bodies of Work — ISH English resource library
   Vanilla JS, no build step. Static-host friendly.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Controlled vocabulary (kept in sync with the add form) ---------- */
  const FIELDS = [
    { slug: "culture-identity-community", label: "Culture, identity & community", color: "#c79a55" },
    { slug: "beliefs-values-education", label: "Beliefs, values & education", color: "#6f9a86" },
    { slug: "politics-power-justice", label: "Politics, power & justice", color: "#c2615a" },
    { slug: "art-creativity-imagination", label: "Art, creativity & the imagination", color: "#9a86bd" },
    { slug: "science-technology-environment", label: "Science, technology & the environment", color: "#5e93b0" },
  ];

  const TEXT_TYPES = [
    ["advertisement", "Advertisement"], ["opinion-column", "Opinion column"],
    ["speech", "Speech"], ["blog", "Blog"], ["infographic", "Infographic"],
    ["cartoon", "Cartoon"], ["photograph", "Photograph"], ["film-tv", "Film / TV"],
    ["song", "Song"], ["website", "Website"], ["news-article", "News article"],
    ["social-media", "Social media"], ["poster", "Poster"], ["podcast", "Podcast"],
  ];

  const CONCEPTS = ["identity", "culture", "creativity", "communication", "perspective", "transformation", "representation"];

  const QUALITIES = [["good", "Good example"], ["bad", "Bad example"], ["neutral", "Neutral"]];

  /* Keyword → field hints for the no-AI suggester */
  const SUGGEST = {
    "culture-identity-community": ["identity", "culture", "race", "racial", "gender", "community", "belonging", "immigrant", "migrant", "diaspora", "heritage", "lgbt", "queer", "feminis", "women", "ethnic", "nation", "language", "humansofnewyork"],
    "beliefs-values-education": ["belief", "value", "religio", "faith", "education", "school", "moral", "ethic", "learning", "universit", "teach", "philosoph", "tradition", "spiritual"],
    "politics-power-justice": ["politic", "power", "justice", "protest", " war", "rights", "government", "law", "freedom", "equality", "propaganda", "election", "activis", "police", "refugee", "colonial", "kaepernick"],
    "art-creativity-imagination": ["art", "creativ", "imagination", "design", "music", "film", "movie", "poem", "paint", "photograph", "aesthetic", "fashion", "architecture", "story", "gallery", "museum"],
    "science-technology-environment": ["science", "technolog", "environment", "climate", " ai ", "artificial intelligence", "digital", "nature", "planet", "pollution", "data", "internet", "health", "space", "energy", "carbon", "emission", "patagonia"],
  };

  const fieldBySlug = Object.fromEntries(FIELDS.map((f) => [f.slug, f]));
  const typeLabel = Object.fromEntries(TEXT_TYPES);
  const qualityLabel = Object.fromEntries(QUALITIES);
  const fieldSlugs = FIELDS.map((f) => f.slug);
  const fieldSlugSet = new Set(fieldSlugs);
  const textTypeSet = new Set(TEXT_TYPES.map(([v]) => v));
  const qualitySet = new Set(QUALITIES.map(([v]) => v));
  const STORE_KEY = "bodiesOfWork.local.v1";
  const ENDPOINT = (window.BOW_CONFIG && typeof window.BOW_CONFIG.endpoint === "string" ? window.BOW_CONFIG.endpoint : "").trim();

  /* ---------- State ---------- */
  const state = {
    items: [],
    shared: [],
    filters: { field: new Set(), textType: new Set(), quality: new Set(), concept: new Set() },
    search: "",
    sort: "recent",
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };
  const toText = (value) => (value == null ? "" : String(value)).trim();
  const safeHref = (url) => {
    const value = toText(url);
    if (!/^https?:\/\//i.test(value)) return null;
    try {
      const u = new URL(value);
      return (u.protocol === "http:" || u.protocol === "https:") ? u.href : null;
    } catch {
      return null;
    }
  };
  const normalizedUrlKey = (url) => {
    const href = safeHref(url);
    if (!href) return "";
    try {
      const u = new URL(href);
      u.hash = "";
      return u.href;
    } catch {
      return "";
    }
  };
  const hostOf = (url) => { const href = safeHref(url); try { return href ? new URL(href).hostname.replace(/^www\./, "") : ""; } catch { return ""; } };

  function listFrom(value) {
    const raw = Array.isArray(value) ? value : (typeof value === "string" ? value.split(",") : []);
    return raw.map(toText).filter(Boolean);
  }

  function normalizeResource(raw, addedBy) {
    if (!raw || typeof raw !== "object") return null;

    const url = toText(raw.url);
    const title = toText(raw.title) || "Untitled";
    const field = toText(raw.field);
    const textType = toText(raw.textType);
    const quality = toText(raw.quality);
    const addedAt = Number(raw.addedAt);

    return {
      ...raw,
      id: toText(raw.id) || "r-" + Math.abs(hashStr(url + title)).toString(36),
      title,
      url,
      source: toText(raw.source) || hostLabel(url),
      field: fieldSlugSet.has(field) ? field : "",
      textType: textTypeSet.has(textType) ? textType : "",
      concepts: listFrom(raw.concepts).filter((c) => CONCEPTS.includes(c)),
      quality: qualitySet.has(quality) ? quality : "neutral",
      themes: listFrom(raw.themes).slice(0, 20),
      note: toText(raw.note),
      year: toText(raw.year),
      addedBy,
      addedAt: Number.isFinite(addedAt) ? addedAt : 0,
    };
  }

  /* ---------- Storage ---------- */
  function loadLocal() {
    try { const raw = localStorage.getItem(STORE_KEY); const arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) ? arr : []; }
    catch { return []; }
  }
  function saveLocal(localItems) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(localItems)); return true; }
    catch { return false; }
  }

  function buildItems() {
    const seed = Array.isArray(window.SEED_RESOURCES) ? window.SEED_RESOURCES : [];
    const local = loadLocal();
    const shared = Array.isArray(state.shared) ? state.shared : [];
    const seen = new Set();
    const out = [];
    // Local optimistic adds, then the shared shelf, then the built-in seed; dedupe by URL.
    const tagged = [].concat(
      local.map((r) => [r, "me"]),
      shared.map((r) => [r, "shared"]),
      seed.map((r) => [r, "seed"])
    );
    for (const [raw, addedBy] of tagged) {
      const r = normalizeResource(raw, addedBy);
      if (!r) continue;
      const key = normalizedUrlKey(r.url) || ("id:" + r.id);
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      out.push(r);
    }
    state.items = out;
  }

  /* ---------- Shared shelf (Google Sheet via Apps Script) ---------- */
  async function fetchShared() {
    if (!ENDPOINT) return null;
    try {
      const res = await fetch(ENDPOINT, { method: "GET" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      return data && Array.isArray(data.resources) ? data.resources : [];
    } catch (e) {
      return null; // null = couldn't reach the shared shelf
    }
  }
  async function postShared(rec) {
    // text/plain keeps it a "simple" request (no CORS preflight); no-cors response is opaque,
    // so success is confirmed by re-fetching the shelf afterwards.
    await fetch(ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(rec),
    });
  }
  function setShelf(mode) {
    const pill = $("#shelfStatus");
    if (!pill) return;
    pill.hidden = false;
    pill.classList.toggle("is-shared", mode === "shared");
    if (mode === "shared") pill.textContent = "On the shared shelf — additions are visible to the whole team";
    else if (mode === "connecting") pill.textContent = "Connecting to the shared shelf…";
    else if (mode === "error") pill.textContent = "Shared shelf unreachable — additions save to this browser";
    else pill.textContent = "This browser only — additions stay on your device";
  }
  function initShared() {
    if (!ENDPOINT) { setShelf("local"); return; }
    setShelf("connecting");
    fetchShared().then((shared) => {
      if (shared) { state.shared = shared; refreshAll(); setShelf("shared"); }
      else { setShelf("error"); }
    });
  }
  function refreshAll() { buildItems(); buildFilters(); reapplyPressed(); render(); }
  function existingKeys() { return new Set(state.items.map((it) => normalizedUrlKey(it.url)).filter(Boolean)); }

  /* ---------- Filtering ---------- */
  function matches(item) {
    const f = state.filters;
    if (f.field.size && !f.field.has(item.field)) return false;
    if (f.textType.size && !f.textType.has(item.textType)) return false;
    if (f.quality.size && !f.quality.has(item.quality)) return false;
    if (f.concept.size && !(item.concepts || []).some((c) => f.concept.has(c))) return false;
    if (state.search) {
      const hay = [item.title, item.source, item.note, (item.themes || []).join(" "), typeLabel[item.textType] || "", (fieldBySlug[item.field] || {}).label || ""].join(" ").toLowerCase();
      if (!hay.includes(state.search)) return false;
    }
    return true;
  }

  function sortItems(arr) {
    const a = arr.slice();
    if (state.sort === "title") a.sort((x, y) => (x.title || "").localeCompare(y.title || ""));
    else if (state.sort === "field") a.sort((x, y) => (x.field || "").localeCompare(y.field || "") || (x.title || "").localeCompare(y.title || ""));
    else a.sort((x, y) => (y.addedAt || 0) - (x.addedAt || 0)); // recent: local adds (with addedAt) float up
    return a;
  }

  /* ---------- Rendering ---------- */
  function render() {
    const grid = $("#grid");
    const empty = $("#empty");
    grid.textContent = "";

    const visible = sortItems(state.items.filter(matches));
    const resultCount = $("#resultCount");
    resultCount.textContent = "";
    const strong = el("strong"); strong.textContent = String(visible.length);
    resultCount.append(strong, document.createTextNode(visible.length === 1 ? " resource" : " resources"));

    empty.hidden = visible.length !== 0;

    const frag = document.createDocumentFragment();
    visible.forEach((item) => frag.appendChild(card(item)));
    grid.appendChild(frag);

    updateFilterCounts();
    updateMastheadStats();
    const clearBtn = $("#clearFilters");
    clearBtn.hidden = !anyFilterActive();
  }

  function updateMastheadStats() {
    const stat = $("#stat");
    const count = state.items.length;
    const fieldCount = new Set(state.items.map((i) => i.field).filter(Boolean)).size;
    const countSpan = el("span");
    const fieldSpan = el("span");
    countSpan.id = "countNum";
    fieldSpan.id = "fieldNum";
    countSpan.textContent = String(count);
    fieldSpan.textContent = String(fieldCount);
    stat.textContent = "";
    stat.append(
      countSpan,
      document.createTextNode(count === 1 ? " resource across " : " resources across "),
      fieldSpan,
      document.createTextNode(fieldCount === 1 ? " field" : " fields")
    );
  }

  function card(item) {
    const field = fieldBySlug[item.field];
    const li = el("li", "card");
    if (field) li.style.setProperty("--field", field.color);

    // meta row
    const meta = el("div", "card__meta");
    if (field) { const t = el("span", "tag-field"); t.textContent = field.label; meta.appendChild(t); }
    if (item.quality === "good" || item.quality === "bad") {
      const b = el("span", "badge " + (item.quality === "good" ? "badge--good" : "badge--bad"));
      b.textContent = item.quality === "good" ? "Good example" : "Bad example";
      meta.appendChild(b);
    }
    if (item.addedBy === "me") { const m = el("span", "card__badge-mine"); m.textContent = "Added here"; meta.appendChild(m); }
    li.appendChild(meta);

    const h = el("h3", "card__title"); h.textContent = item.title || "Untitled"; li.appendChild(h);

    const src = el("p", "card__source");
    const parts = [];
    if (item.textType && typeLabel[item.textType]) parts.push(typeLabel[item.textType]);
    if (item.source) parts.push(item.source);
    if (item.year) parts.push(String(item.year));
    parts.forEach((p, i) => {
      if (i) { const d = el("span", "dot"); d.textContent = "·"; src.appendChild(d); }
      src.appendChild(document.createTextNode(p));
    });
    li.appendChild(src);

    if (item.note) { const n = el("p", "card__note"); n.textContent = "“" + item.note + "”"; li.appendChild(n); }

    if (Array.isArray(item.themes) && item.themes.length) {
      const ul = el("ul", "card__themes");
      item.themes.slice(0, 6).forEach((th) => { const t = el("li"); t.textContent = th; ul.appendChild(t); });
      li.appendChild(ul);
    }

    const foot = el("div", "card__foot");
    const href = safeHref(item.url);
    if (href) {
      const a = el("a", "card__open");
      a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer";
      a.append(document.createTextNode("Open source"));
      const svg = iconArrow(); a.appendChild(svg);
      foot.appendChild(a);
    } else {
      const span = el("span", "card__ttype"); span.textContent = "No link"; foot.appendChild(span);
    }
    if (item.addedBy === "me") {
      const del = el("button", "card__del"); del.type = "button"; del.textContent = "Remove";
      del.addEventListener("click", () => removeItem(item.id));
      foot.appendChild(del);
    }
    li.appendChild(foot);
    return li;
  }

  function iconArrow() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("class", "icon"); svg.setAttribute("aria-hidden", "true");
    svg.style.width = "0.95em"; svg.style.height = "0.95em";
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", "M7 17 17 7M9 7h8v8");
    svg.appendChild(p); return svg;
  }

  /* ---------- Filter UI ---------- */
  function buildFilters() {
    fillChips("field", FIELDS.map((f) => ({ value: f.slug, label: f.label, color: f.color })));
    fillChips("textType", presentTextTypes().map(([v, l]) => ({ value: v, label: l })));
    fillChips("quality", [{ value: "good", label: "Good", color: "#7faa78" }, { value: "bad", label: "Bad", color: "#cf7b6b" }, { value: "neutral", label: "Neutral" }]);
    fillChips("concept", CONCEPTS.map((c) => ({ value: c, label: cap(c) })));
  }

  function presentTextTypes() {
    const present = new Set(state.items.map((i) => i.textType));
    return TEXT_TYPES.filter(([v]) => present.has(v));
  }

  function fillChips(group, options) {
    const wrap = $(`.filter-group[data-group="${group}"] .filter-group__options`);
    if (!wrap) return;
    wrap.textContent = "";
    options.forEach((opt) => {
      const chip = el("button", "chip");
      chip.type = "button";
      chip.setAttribute("aria-pressed", "false");
      chip.dataset.group = group;
      chip.dataset.value = opt.value;
      if (opt.color) { const dot = el("span", "chip__dot"); dot.style.setProperty("--dot", opt.color); chip.style.setProperty("--dot", opt.color); chip.appendChild(dot); }
      const lbl = el("span"); lbl.textContent = opt.label; chip.appendChild(lbl);
      const count = el("span", "chip__count"); chip.appendChild(count);
      chip.addEventListener("click", () => toggleFilter(group, opt.value, chip));
      wrap.appendChild(chip);
    });
  }

  function toggleFilter(group, value, chip) {
    const set = state.filters[group];
    if (set.has(value)) set.delete(value); else set.add(value);
    chip.setAttribute("aria-pressed", set.has(value) ? "true" : "false");
    render();
  }

  function updateFilterCounts() {
    document.querySelectorAll(".chip").forEach((chip) => {
      const { group, value } = chip.dataset;
      const n = state.items.filter((it) => {
        if (group === "concept") return (it.concepts || []).includes(value);
        return it[group] === value;
      }).length;
      const c = chip.querySelector(".chip__count");
      if (c) c.textContent = n ? String(n) : "";
    });
  }

  function anyFilterActive() {
    return Object.values(state.filters).some((s) => s.size > 0) || state.search.length > 0;
  }

  function clearFilters() {
    Object.values(state.filters).forEach((s) => s.clear());
    state.search = "";
    state.sort = "recent";
    $("#search").value = "";
    $("#sort").value = state.sort;
    document.querySelectorAll('.chip[aria-pressed="true"]').forEach((c) => c.setAttribute("aria-pressed", "false"));
    render();
  }

  /* ---------- Add modal ---------- */
  let modalReturnFocus = null;

  function buildModalControls() {
    // field chooser
    const fc = $("#fieldChooser");
    FIELDS.forEach((f) => {
      const b = el("button", "chooser__opt");
      b.type = "button"; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", "false");
      b.dataset.value = f.slug; b.style.setProperty("--dot", f.color);
      const s = el("span"); s.textContent = f.label; b.appendChild(s);
      b.addEventListener("click", () => selectField(f.slug, true));
      fc.appendChild(b);
    });
    // text type select
    const sel = $("#textTypeInput");
    TEXT_TYPES.forEach(([v, l]) => { const o = el("option"); o.value = v; o.textContent = l; sel.appendChild(o); });
    // quality toggle
    const qt = $("#qualityToggle");
    QUALITIES.forEach(([v, l], i) => {
      const b = el("button", "toggle__opt");
      b.type = "button"; b.setAttribute("role", "radio"); b.dataset.value = v;
      b.setAttribute("aria-checked", i === 0 ? "true" : "false");
      b.textContent = l.replace(" example", "");
      b.addEventListener("click", () => selectQuality(v));
      qt.appendChild(b);
    });
    // roving tabindex + arrow-key navigation so each group behaves as a true radiogroup
    initRoving(fc);
    initRoving(qt);
    wireRadioKeys(fc);
    wireRadioKeys(qt);
  }

  function radioOpts(container) { return Array.from(container.querySelectorAll('[role="radio"]')); }
  function initRoving(container) {
    const opts = radioOpts(container);
    const target = opts.find((o) => o.getAttribute("aria-checked") === "true") || opts[0];
    opts.forEach((o) => { o.tabIndex = o === target ? 0 : -1; });
  }
  function wireRadioKeys(container) {
    container.addEventListener("keydown", (e) => {
      const opts = radioOpts(container);
      const i = opts.indexOf(document.activeElement);
      if (i < 0) return;
      let j = i;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") j = (i + 1) % opts.length;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = (i - 1 + opts.length) % opts.length;
      else if (e.key === "Home") j = 0;
      else if (e.key === "End") j = opts.length - 1;
      else return;
      e.preventDefault();
      opts[j].click();
      opts[j].focus();
    });
  }

  let chosenField = null;
  function selectField(slug, manual) {
    chosenField = slug;
    document.querySelectorAll("#fieldChooser .chooser__opt").forEach((b) => {
      const on = b.dataset.value === slug;
      b.setAttribute("aria-checked", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    if (manual) { const note = $("#suggestNote"); note.hidden = true; }
  }
  function selectQuality(v) {
    document.querySelectorAll("#qualityToggle .toggle__opt").forEach((b) => {
      const on = b.dataset.value === v;
      b.setAttribute("aria-checked", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
  }
  function currentQuality() {
    const on = $('#qualityToggle .toggle__opt[aria-checked="true"]');
    return on ? on.dataset.value : "good";
  }

  function suggestField() {
    const text = ((($("#urlInput").value || "") + " " + ($("#titleInput").value || "") + " " + ($("#themesInput").value || "")).toLowerCase());
    if (!text.trim()) return;
    let best = null, bestScore = 0;
    for (const slug of Object.keys(SUGGEST)) {
      const score = SUGGEST[slug].reduce((acc, kw) => acc + (text.includes(kw) ? 1 : 0), 0);
      if (score > bestScore) { bestScore = score; best = slug; }
    }
    if (best && bestScore > 0) {
      selectField(best, false);
      const note = $("#suggestNote");
      note.textContent = "· suggested for you — tap to change";
      note.hidden = false;
    }
  }

  function openModal() {
    modalReturnFocus = document.activeElement;
    const dlg = $("#addModal");
    $("#addForm").reset();
    chosenField = null;
    document.querySelectorAll("#fieldChooser .chooser__opt").forEach((b, idx) => { b.setAttribute("aria-checked", "false"); b.tabIndex = idx === 0 ? 0 : -1; });
    selectQuality("good");
    $("#suggestNote").hidden = true;
    $("#formError").hidden = true;
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
    $("#urlInput").focus();
  }
  function closeModal() {
    const dlg = $("#addModal");
    if (dlg.open) dlg.close();
    if (modalReturnFocus && typeof modalReturnFocus.focus === "function") modalReturnFocus.focus();
  }

  function collectForm() {
    const url = $("#urlInput").value.trim();
    const title = $("#titleInput").value.trim();
    const themes = $("#themesInput").value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10);
    const note = $("#noteInput").value.trim();
    return {
      id: "r-" + Math.abs(hashStr(url + title)).toString(36) + "-" + (state.items.length + 1),
      title, url,
      source: hostLabel(url),
      field: chosenField,
      textType: $("#textTypeInput").value,
      concepts: [],
      quality: currentQuality(),
      themes, note,
      addedBy: "me",
      addedAt: nowSeconds(),
    };
  }

  function validate(rec) {
    if (!safeHref(rec.url)) return "Please paste a valid web link (starting with http).";
    if (!rec.title) return "Give it a short title so people can find it.";
    if (!rec.field) return "Tap which field of inquiry it belongs to.";
    return null;
  }

  function persistLocal(rec) {
    const local = loadLocal();
    local.unshift(rec);
    return saveLocal(local);
  }

  async function onSubmit(e) {
    e.preventDefault();
    const box = $("#formError");
    const rec = collectForm();
    const err = validate(rec);
    if (err) { box.textContent = err; box.hidden = false; return; }
    const key = normalizedUrlKey(rec.url);
    if (key && existingKeys().has(key)) { box.textContent = "That link is already on the shelf."; box.hidden = false; return; }

    if (ENDPOINT) { await addToShared(rec, box); return; }

    if (!persistLocal(rec)) { box.textContent = "Couldn't save to this browser's storage."; box.hidden = false; return; }
    refreshAll();
    closeModal();
    toast("Added — saved on this device");
  }

  async function addToShared(rec) {
    const saveBtn = $("#saveBtn");
    saveBtn.disabled = true;
    toast("Adding to the shared shelf…");
    try { await postShared(rec); } catch (e) { /* opaque (no-cors); confirmed by refetch below */ }
    const shared = await fetchShared();
    if (shared) state.shared = shared;
    refreshAll();
    saveBtn.disabled = false;
    const key = normalizedUrlKey(rec.url);
    if (key && existingKeys().has(key)) {
      closeModal();
      toast("Added to the shared shelf");
    } else {
      // couldn't confirm the write — keep it on this device so nothing is lost
      persistLocal(rec); refreshAll(); closeModal();
      toast("Saved on this device — couldn't reach the shared shelf");
    }
  }

  function removeItem(id) {
    if (!window.confirm("Remove this resource from your shelf?")) return;
    const local = loadLocal().filter((r) => r.id !== id);
    saveLocal(local);
    buildItems(); buildFilters(); reapplyPressed(); render();
    toast("Removed");
  }

  async function copySubmission() {
    const rec = collectForm();
    const err = validate(rec);
    if (err) { const box = $("#formError"); box.textContent = err; box.hidden = false; return; }
    const payload = JSON.stringify({ ...rec, addedBy: undefined, addedAt: undefined }, (k, v) => (v === undefined ? undefined : v), 2);
    try {
      await navigator.clipboard.writeText(payload);
      toast("Submission copied — send it to the curator");
    } catch {
      // fallback: surface text for manual copy
      const box = $("#formError"); box.hidden = false; box.textContent = "Copy failed — here it is to copy by hand: " + payload;
    }
  }

  /* ---------- Misc helpers ---------- */
  function reapplyPressed() {
    document.querySelectorAll(".chip").forEach((chip) => {
      const set = state.filters[chip.dataset.group];
      chip.setAttribute("aria-pressed", set && set.has(chip.dataset.value) ? "true" : "false");
    });
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function hostLabel(url) {
    const h = hostOf(url);
    if (!h) return "";
    const map = { "youtube.com": "YouTube", "youtu.be": "YouTube", "vimeo.com": "Vimeo", "theguardian.com": "The Guardian", "nytimes.com": "The New York Times", "bbc.co.uk": "BBC", "bbc.com": "BBC" };
    return map[h] || h;
  }
  function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; } return h; }
  // Date.now avoided per environment constraints elsewhere; in-browser it's fine, but keep a guard.
  function nowSeconds() { try { return Math.floor(Date.now() / 1000); } catch { return state.items.length + 1; } }

  let toastTimer = null;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false;
    requestAnimationFrame(() => t.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.classList.remove("show"); setTimeout(() => { t.hidden = true; }, 260); }, 2600);
  }

  /* ---------- Wiring ---------- */
  function init() {
    buildItems();
    buildFilters();
    buildModalControls();
    render();

    $("#search").addEventListener("input", (e) => { state.search = e.target.value.trim().toLowerCase(); render(); });
    $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
    $("#clearFilters").addEventListener("click", clearFilters);

    $("#addBtn").addEventListener("click", openModal);
    $("#closeModal").addEventListener("click", closeModal);
    $("#addForm").addEventListener("submit", onSubmit);
    $("#copySubmission").addEventListener("click", copySubmission);
    $("#addModal").addEventListener("cancel", (e) => { e.preventDefault(); closeModal(); });
    $("#urlInput").addEventListener("blur", suggestField);
    $("#titleInput").addEventListener("blur", suggestField);

    const toggle = $("#filtersToggle");
    toggle.addEventListener("click", () => {
      const open = $("#filters").classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    initShared();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
