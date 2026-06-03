/* ============================================================
   Bodies of Work — shared shelf backend (Google Apps Script)

   Turns a plain Google Sheet into a free shared database for the
   whole English team:
     • GET  → returns every visible resource as JSON (the site reads this)
     • POST → validates a new resource and appends it as a row

   SETUP (see SETUP-SHARING.md):
     1. Make a new Google Sheet (sheet.new) on your ISH account.
     2. Extensions → Apps Script. Delete the sample, paste THIS file.
     3. Deploy → New deployment → Web app → Execute as: Me · Who has access: Anyone.
        Authorise, then COPY the /exec URL.
     4. Paste that URL into config.js (the `endpoint` value) and redeploy the site.

   The header row is created automatically. Hide a junk entry by setting its
   `status` cell to "hidden" (or delete the row).
   ============================================================ */

var SHEET_NAME = "resources";
var HEADERS = ["timestamp", "id", "title", "url", "source", "themes", "field",
  "textType", "quality", "tags", "note", "year", "addedByName", "status"];
var THEMES = ["race", "war", "gender", "mental-health", "feminism", "lgbtqi",
  "environment", "inequality", "social-mobility", "modernisation"];

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) { sh = ss.getSheets()[0]; sh.setName(SHEET_NAME); }
  if (sh.getLastRow() === 0) sh.appendRow(HEADERS);
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function splitList_(v) {
  return String(v == null ? "" : v).split(",").map(function (s) { return s.trim(); }).filter(Boolean);
}

function rowToObj_(r, i) {
  return {
    id: String(r[i.id] || ""),
    title: String(r[i.title] || ""),
    url: String(r[i.url] || ""),
    source: String(r[i.source] || ""),
    themes: splitList_(r[i.themes]),
    field: String(r[i.field] || ""),
    textType: String(r[i.textType] || ""),
    quality: String(r[i.quality] || "neutral"),
    tags: splitList_(r[i.tags]),
    note: String(r[i.note] || ""),
    year: r[i.year] === "" ? "" : r[i.year],
    addedByName: String(r[i.addedByName] || ""),
    addedAt: r[i.timestamp] ? Math.floor(new Date(r[i.timestamp]).getTime() / 1000) : 0,
    addedBy: "shared"
  };
}

function doGet() {
  var sh = sheet_();
  var rows = sh.getDataRange().getValues();
  var i = {};
  HEADERS.forEach(function (h, n) { i[h] = n; });
  var out = [];
  var hidden = [];      // hidden team additions (full data, for the "Hidden items" bin)
  var hiddenIds = [];   // every hidden id (additions + seed tombstones) — the site filters these out
  rows.forEach(function (r, idx) {
    if (idx === 0) return; // header row
    if (String(r[i.id]) === "id" || String(r[i.timestamp]) === "timestamp") return; // stray header
    var id = String(r[i.id] || "");
    if (String(r[i.status] || "").toLowerCase() === "hidden") {
      if (id) hiddenIds.push(id);
      if (r[i.url] || r[i.title]) hidden.push(rowToObj_(r, i)); // a real (team-added) hidden entry
      return; // a seed tombstone has no url/title — only its id matters
    }
    if (!r[i.url] && !r[i.title]) return; // blank row
    out.push(rowToObj_(r, i));
  });
  return json_({ ok: true, count: out.length, resources: out, hiddenIds: hiddenIds, hidden: hidden });
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var action = String(body.action || "").toLowerCase();
    if (action === "hide") return setHidden_(body.id, true);
    if (action === "unhide") return setHidden_(body.id, false);

    var title = String(body.title || "").trim();
    var url = String(body.url || "").trim();
    var themes = (Array.isArray(body.themes) ? body.themes : splitList_(body.themes))
      .map(function (t) { return String(t).trim(); })
      .filter(function (t) { return THEMES.indexOf(t) >= 0; });

    if (!/^https?:\/\//i.test(url)) return json_({ ok: false, error: "invalid url" });
    if (!title) return json_({ ok: false, error: "missing title" });
    if (!themes.length) return json_({ ok: false, error: "need at least one valid theme" });

    var sh = sheet_();
    var id = "r-" + Utilities.getUuid().slice(0, 8);
    sh.appendRow([
      new Date(),
      id,
      title.slice(0, 300),
      url,
      String(body.source || "").slice(0, 160),
      themes.join(", "),
      String(body.field || ""),
      String(body.textType || ""),
      String(body.quality || "neutral"),
      (Array.isArray(body.tags) ? body.tags.join(", ") : splitList_(body.tags).join(", ")).slice(0, 240),
      String(body.note || "").slice(0, 700),
      String(body.year || ""),
      String(body.addedByName || "").slice(0, 80),
      ""
    ]);
    return json_({ ok: true, id: id });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* Hide (soft, reversible) or unhide a resource by id.
   - A team addition (a real sheet row): set/clear its `status` cell.
   - A seed resource (lives in the site's data.js, not the sheet): record the hide
     as a tombstone row (id + status=hidden, no content); unhide deletes that row.
   Nothing is ever hard-deleted, so every removal is reversible. */
function setHidden_(id, makeHidden) {
  id = String(id || "").trim();
  if (!id) return json_({ ok: false, error: "missing id" });
  var sh = sheet_();
  var rows = sh.getDataRange().getValues();
  var i = {};
  HEADERS.forEach(function (h, n) { i[h] = n; });
  for (var r = 1; r < rows.length; r++) {
    if (String(rows[r][i.id]) === id) {
      if (makeHidden) {
        sh.getRange(r + 1, i.status + 1).setValue("hidden");
      } else if (rows[r][i.url] || rows[r][i.title]) {
        sh.getRange(r + 1, i.status + 1).setValue(""); // restore a real addition
      } else {
        sh.deleteRow(r + 1); // remove a seed-hide tombstone → seed reappears
      }
      return json_({ ok: true, id: id, hidden: makeHidden });
    }
  }
  if (makeHidden) {
    var tomb = HEADERS.map(function () { return ""; });
    tomb[i.timestamp] = new Date();
    tomb[i.id] = id;
    tomb[i.status] = "hidden";
    sh.appendRow(tomb);
    return json_({ ok: true, id: id, hidden: true });
  }
  return json_({ ok: true, id: id, hidden: false });
}
