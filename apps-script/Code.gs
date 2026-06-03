/* ============================================================
   Bodies of Work — shared shelf backend (Google Apps Script)

   This turns a plain Google Sheet into a free shared database for
   the whole English team. It does two things:
     • GET  → returns every visible resource as JSON (the site reads this)
     • POST → validates a new resource and appends it as a row

   SETUP (see SETUP-SHARING.md for screenshots-level detail):
     1. Make a new Google Sheet (sheet.new).
     2. Extensions → Apps Script. Delete the sample, paste THIS file.
     3. Deploy → New deployment → type "Web app":
          - Execute as: Me
          - Who has access: Anyone
        Authorise when asked, then COPY the /exec URL.
     4. Paste that URL into config.js (the `endpoint` value) and redeploy the site.

   The sheet's header row is created automatically on first use.
   To remove a junk entry, set its `status` cell to "hidden" (or delete the row).
   ============================================================ */

var SHEET_NAME = "resources";
var HEADERS = ["timestamp", "id", "title", "url", "source", "field", "textType",
  "concepts", "quality", "themes", "note", "year", "addedByName", "status"];
var FIELDS = ["culture-identity-community", "beliefs-values-education",
  "politics-power-justice", "art-creativity-imagination", "science-technology-environment"];

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.getSheets()[0];
    sh.setName(SHEET_NAME);
  }
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

function doGet() {
  var sh = sheet_();
  var rows = sh.getDataRange().getValues();
  rows.shift(); // drop header
  var i = {};
  HEADERS.forEach(function (h, n) { i[h] = n; });
  var out = [];
  rows.forEach(function (r) {
    if (String(r[i.status] || "").toLowerCase() === "hidden") return;
    if (!r[i.url] && !r[i.title]) return;
    out.push({
      id: String(r[i.id] || ""),
      title: String(r[i.title] || ""),
      url: String(r[i.url] || ""),
      source: String(r[i.source] || ""),
      field: String(r[i.field] || ""),
      textType: String(r[i.textType] || ""),
      concepts: splitList_(r[i.concepts]),
      quality: String(r[i.quality] || "neutral"),
      themes: splitList_(r[i.themes]),
      note: String(r[i.note] || ""),
      year: r[i.year] === "" ? "" : r[i.year],
      addedByName: String(r[i.addedByName] || ""),
      addedAt: r[i.timestamp] ? Math.floor(new Date(r[i.timestamp]).getTime() / 1000) : 0,
      addedBy: "shared"
    });
  });
  return json_({ ok: true, count: out.length, resources: out });
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var title = String(body.title || "").trim();
    var url = String(body.url || "").trim();
    var field = String(body.field || "").trim();

    if (!/^https?:\/\//i.test(url)) return json_({ ok: false, error: "invalid url" });
    if (!title) return json_({ ok: false, error: "missing title" });
    if (FIELDS.indexOf(field) < 0) return json_({ ok: false, error: "invalid field" });

    var sh = sheet_();
    var id = "r-" + Utilities.getUuid().slice(0, 8);
    sh.appendRow([
      new Date(),
      id,
      title.slice(0, 300),
      url,
      String(body.source || "").slice(0, 120),
      field,
      String(body.textType || ""),
      (Array.isArray(body.concepts) ? body.concepts.join(", ") : splitList_(body.concepts).join(", ")),
      String(body.quality || "neutral"),
      (Array.isArray(body.themes) ? body.themes.join(", ") : splitList_(body.themes).join(", ")),
      String(body.note || "").slice(0, 600),
      String(body.year || ""),
      String(body.addedByName || "").slice(0, 80),
      ""
    ]);
    return json_({ ok: true, id: id });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}
