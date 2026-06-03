/* End-to-end tests for the Bodies of Work library.
   Run:  node tests/library.test.cjs   (server must be on http://localhost:4175)
   Uses the Playwright install bundled with the playwright-skill. */
const path = require("path");
const PW = "/Users/a.tanasel/.claude/skills/playwright-skill/node_modules/playwright";
const { chromium } = require(PW);

const BASE = process.env.BASE || "http://localhost:4175";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.error("  ✗ " + m); } };

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));

  // ---- Load ----
  console.log("\n[load]");
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector(".card");
  const cardCount = await page.locator(".card").count();
  ok(cardCount === 16, `16 seed cards render (got ${cardCount})`);
  ok((await page.locator("#countNum").textContent()) === "16", "masthead count = 16");
  ok(/16 resources/.test(await page.locator("#resultCount").textContent()), "result count says 16 resources");
  ok(errors.length === 0, `no console errors on load (${JSON.stringify(errors).slice(0, 160)})`);

  // ---- Filter (AND across, OR within) ----
  console.log("\n[filter]");
  await page.click('.chip[data-group="field"][data-value="politics-power-justice"]');
  let n = await page.locator(".card").count();
  ok(n === 4, `politics field → 4 cards (got ${n})`);
  const allPolitics = await page.$$eval(".card .tag-field", (els) => els.every((e) => /Politics/.test(e.textContent)));
  ok(allPolitics, "all visible cards are Politics");
  await page.click("#clearFilters");
  n = await page.locator(".card").count();
  ok(n === 16, `clear filters → back to 16 (got ${n})`);

  // ---- Search ----
  console.log("\n[search]");
  await page.fill("#search", "reparations");
  await page.waitForTimeout(60);
  n = await page.locator(".card").count();
  ok(n === 1, `search "reparations" → 1 (got ${n})`);
  await page.fill("#search", "zzzznotathing");
  await page.waitForTimeout(60);
  ok((await page.locator("#empty").isVisible()), "no-results empty state shows");
  await page.fill("#search", "");
  await page.waitForTimeout(60);

  // ---- Add flow + no-AI suggester ----
  console.log("\n[add + suggester]");
  await page.click("#addBtn");
  await page.waitForSelector("#addModal[open]");
  await page.fill("#urlInput", "https://www.bbc.com/news/climate-carbon-emissions-planet");
  await page.fill("#titleInput", "BBC — Climate change and carbon emissions");
  await page.locator("#titleInput").blur();
  await page.waitForTimeout(50);
  const suggested = await page.getAttribute('#fieldChooser .chooser__opt[aria-checked="true"]', "data-value");
  ok(suggested === "science-technology-environment", `suggester picked science (got ${suggested})`);
  await page.click("#saveBtn");
  await page.waitForTimeout(80);
  ok(!(await page.locator("#addModal").evaluate((d) => d.open)), "modal closes after save");
  n = await page.locator(".card").count();
  ok(n === 17, `card added → 17 (got ${n})`);
  ok((await page.locator("#countNum").textContent()) === "17", "masthead count updates to 17");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("bodiesOfWork.local.v1") || "[]"));
  ok(stored.length === 1 && stored[0].field === "science-technology-environment", "persisted to localStorage with right field");

  // ---- Persistence across reload ----
  console.log("\n[persist]");
  await page.reload({ waitUntil: "networkidle" });
  n = await page.locator(".card").count();
  ok(n === 17, `addition survives reload → 17 (got ${n})`);

  // ---- Duplicate guard ----
  console.log("\n[dup guard]");
  await page.click("#addBtn");
  await page.fill("#urlInput", "https://www.bbc.com/news/climate-carbon-emissions-planet");
  await page.fill("#titleInput", "Different title same link");
  await page.click('#fieldChooser .chooser__opt[data-value="politics-power-justice"]');
  await page.click("#saveBtn");
  await page.waitForTimeout(50);
  ok(await page.locator("#formError").isVisible(), "duplicate link is rejected with an error");
  n = await page.locator(".card").count();
  ok(n === 17, `still 17 after duplicate attempt (got ${n})`);
  await page.click("#closeModal");

  // ---- XSS safety ----
  console.log("\n[xss]");
  // 1) malicious scheme must be rejected
  await page.click("#addBtn");
  await page.fill("#urlInput", "javascript:window.__xss=1");
  await page.fill("#titleInput", "evil");
  await page.click('#fieldChooser .chooser__opt[data-value="politics-power-justice"]');
  await page.click("#saveBtn");
  await page.waitForTimeout(40);
  ok(await page.locator("#formError").isVisible(), "javascript: URL rejected");
  // 2) HTML in title is rendered as text, not executed
  await page.fill("#urlInput", "https://example.com/xss-test-article");
  await page.fill("#titleInput", '<img src=x onerror="window.__xss=1">hello');
  await page.click("#saveBtn");
  await page.waitForTimeout(60);
  const xssFired = await page.evaluate(() => window.__xss === 1);
  ok(!xssFired, "HTML/script in title does NOT execute");
  const literal = await page.evaluate(() => !!document.querySelector("#grid img[src='x']") === false);
  ok(literal, "no injected <img> element in the DOM");

  // ---- reset store ----
  await page.evaluate(() => localStorage.removeItem("bodiesOfWork.local.v1"));
  await page.reload({ waitUntil: "networkidle" });
  ok((await page.locator(".card").count()) === 16, "store reset → 16");

  // ---- a11y: Escape closes modal ----
  console.log("\n[a11y]");
  await page.click("#addBtn");
  await page.waitForSelector("#addModal[open]");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(40);
  ok(!(await page.locator("#addModal").evaluate((d) => d.open)), "Escape closes the modal");
  // arrow-key navigation of the field radiogroup
  await page.click("#addBtn");
  await page.waitForSelector("#addModal[open]");
  await page.focus('#fieldChooser .chooser__opt[data-value="culture-identity-community"]');
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(30);
  const afterArrow = await page.getAttribute('#fieldChooser .chooser__opt[aria-checked="true"]', "data-value");
  ok(afterArrow === "beliefs-values-education", `ArrowDown moves field selection (got ${afterArrow})`);
  await page.keyboard.press("Escape");

  // ---- responsive: no horizontal overflow ----
  console.log("\n[responsive]");
  for (const w of [320, 360, 375, 768]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.waitForTimeout(40);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    ok(!overflow, `no horizontal overflow at ${w}px`);
  }

  await browser.close();
  console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
