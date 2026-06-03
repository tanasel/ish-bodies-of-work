/* End-to-end tests for the Bodies of Work library (theme-organised, real ISH data).
   Run:  node tests/library.test.cjs   (server must be on http://localhost:4175) */
const PW = "/Users/a.tanasel/.claude/skills/playwright-skill/node_modules/playwright";
const { chromium } = require(PW);

const BASE = process.env.BASE || "http://localhost:4175";
const TOTAL = 44;       // unique resources in data.js
const WAR = 11;         // resources tagged theme "war"
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.error("  ✗ " + m); } };

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));

  console.log("\n[load]");
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector(".card");
  const n0 = await page.locator(".card").count();
  ok(n0 === TOTAL, `${TOTAL} seed cards render (got ${n0})`);
  ok((await page.locator("#countNum").textContent()) === String(TOTAL), `masthead count = ${TOTAL}`);
  ok(/(\d+) resources/.test(await page.locator("#resultCount").textContent()), "result count shows resources");
  ok(errors.length === 0, `no console errors on load (${JSON.stringify(errors).slice(0, 160)})`);

  console.log("\n[theme filter]");
  await page.click('.chip[data-group="theme"][data-value="war"]');
  let n = await page.locator(".card").count();
  ok(n === WAR, `theme "war" → ${WAR} cards (got ${n})`);
  const allWar = await page.$$eval(".card", (cards) => cards.every((c) => [...c.querySelectorAll(".tag-field")].some((t) => /War/.test(t.textContent))));
  ok(allWar, "every visible card carries the War theme");
  await page.click("#clearFilters");
  n = await page.locator(".card").count();
  ok(n === TOTAL, `clear filters → ${TOTAL} (got ${n})`);

  console.log("\n[field filter — secondary]");
  await page.click('.chip[data-group="field"][data-value="politics-power-justice"]');
  n = await page.locator(".card").count();
  ok(n > 0 && n < TOTAL, `IB field filter narrows results (got ${n})`);
  await page.click("#clearFilters");

  console.log("\n[search]");
  await page.fill("#search", "parasite");
  await page.waitForTimeout(60);
  n = await page.locator(".card").count();
  ok(n === 1, `search "parasite" → 1 (got ${n})`);
  await page.fill("#search", "zzzznotathing");
  await page.waitForTimeout(60);
  ok(await page.locator("#empty").isVisible(), "no-results empty state shows");
  await page.fill("#search", "");
  await page.waitForTimeout(60);

  console.log("\n[add + theme suggester]");
  await page.click("#addBtn");
  await page.waitForSelector("#addModal[open]");
  await page.fill("#urlInput", "https://www.bbc.com/news/climate-carbon-emissions-and-the-planet");
  await page.fill("#titleInput", "BBC — Climate change and carbon emissions explained");
  await page.locator("#titleInput").blur();
  await page.waitForTimeout(50);
  const suggested = await page.getAttribute('#themeChooser .chooser__opt[aria-checked="true"]', "data-value");
  ok(suggested === "environment", `suggester picked theme "environment" (got ${suggested})`);
  await page.click("#saveBtn");
  await page.waitForTimeout(80);
  ok(!(await page.locator("#addModal").evaluate((d) => d.open)), "modal closes after save");
  n = await page.locator(".card").count();
  ok(n === TOTAL + 1, `card added → ${TOTAL + 1} (got ${n})`);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("bodiesOfWork.local.v1") || "[]"));
  ok(stored.length === 1 && stored[0].themes.includes("environment"), "persisted with the environment theme");
  ok(stored[0].field === "science-technology-environment", "field auto-derived from theme");

  console.log("\n[persist]");
  await page.reload({ waitUntil: "networkidle" });
  n = await page.locator(".card").count();
  ok(n === TOTAL + 1, `addition survives reload → ${TOTAL + 1} (got ${n})`);

  console.log("\n[dup guard]");
  await page.click("#addBtn");
  await page.fill("#urlInput", "https://www.bbc.com/news/climate-carbon-emissions-and-the-planet");
  await page.fill("#titleInput", "Different title same link");
  await page.click('#themeChooser .chooser__opt[data-value="war"]');
  await page.click("#saveBtn");
  await page.waitForTimeout(50);
  ok(await page.locator("#formError").isVisible(), "duplicate link is rejected");
  ok((await page.locator(".card").count()) === TOTAL + 1, "still no extra card after duplicate");
  await page.click("#closeModal");

  console.log("\n[xss]");
  await page.click("#addBtn");
  await page.fill("#urlInput", "javascript:window.__xss=1");
  await page.fill("#titleInput", "evil");
  await page.click('#themeChooser .chooser__opt[data-value="race"]');
  await page.click("#saveBtn");
  await page.waitForTimeout(40);
  ok(await page.locator("#formError").isVisible(), "javascript: URL rejected");
  await page.fill("#urlInput", "https://example.com/xss-probe");
  await page.fill("#titleInput", '<img src=x onerror="window.__xss=1">hi');
  await page.click("#saveBtn");
  await page.waitForTimeout(60);
  ok(!(await page.evaluate(() => window.__xss === 1)), "HTML/script in title does NOT execute");
  ok(await page.evaluate(() => !document.querySelector("#grid img[src='x']")), "no injected <img> in DOM");

  await page.evaluate(() => localStorage.removeItem("bodiesOfWork.local.v1"));
  await page.reload({ waitUntil: "networkidle" });
  ok((await page.locator(".card").count()) === TOTAL, `store reset → ${TOTAL}`);

  console.log("\n[a11y]");
  await page.click("#addBtn");
  await page.waitForSelector("#addModal[open]");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(40);
  ok(!(await page.locator("#addModal").evaluate((d) => d.open)), "Escape closes the modal");
  await page.click("#addBtn");
  await page.focus('#qualityToggle .toggle__opt[data-value="good"]');
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(30);
  const q = await page.getAttribute('#qualityToggle .toggle__opt[aria-checked="true"]', "data-value");
  ok(q === "bad", `ArrowRight moves quality radiogroup good→bad (got ${q})`);
  await page.keyboard.press("Escape");

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
