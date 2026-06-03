# Turn on the shared shelf (whole-team adding)

Right now the site shows the same library to everyone, but each person's
**additions stay in their own browser**. These four steps connect it to a free
**Google Sheet** so the whole English team adds to *one* shelf everyone sees.

No coding, no cost, no new accounts for colleagues. ~10 minutes, done once.

> The site keeps working at every stage — if this is half-done or the sheet is
> ever unreachable, it just falls back to "this browser only".

---

## Step 1 — Make the sheet
1. Go to **https://sheet.new** (signed in as the Google account that should own it —
   your school account is best for a department tool).
2. Name it something like **"Bodies of Work — shared shelf"**. Leave it blank;
   the script adds the column headers itself.

## Step 2 — Add the script
1. In that sheet: **Extensions → Apps Script**.
2. Delete the little `function myFunction() {}` sample.
3. Open **`apps-script/Code.gs`** from this project, copy **all** of it, paste it in.
4. Click the **Save** icon (💾).

## Step 3 — Deploy it as a web app
1. Click **Deploy → New deployment**.
2. Click the gear ⚙ next to "Select type" → choose **Web app**.
3. Set:
   - **Execute as:** *Me*
   - **Who has access:** *Anyone*
4. Click **Deploy**. Google will ask you to **authorise** — approve it (it's your own
   script editing your own sheet; the "unverified" warning is normal → *Advanced →
   Go to … (unsafe)* → Allow).
5. Copy the **Web app URL** — it ends in **`/exec`**.

## Step 4 — Connect the site
Two ways:
- **Easiest:** send me that `/exec` URL and I'll wire it in and redeploy. *(Recommended —
  I'll also test the full round-trip with you.)*
- **Yourself:** open **`config.js`**, paste the URL between the quotes:
  ```js
  window.BOW_CONFIG = { endpoint: "https://script.google.com/macros/s/AKfy.../exec" };
  ```
  then commit & push (GitHub Pages redeploys automatically).

---

## When it's on
- The status line under "Add a resource" turns green: **"On the shared shelf…"**.
- Anyone's **Add** writes a new row to the sheet; everyone sees it on their next visit.
- To **remove** a junk entry: open the sheet and set that row's **`status`** cell to
  `hidden` (or just delete the row).
- You stay the curator without being a bottleneck — the team adds freely, you tidy.

## Notes
- The sheet lives on whichever Google account you used in Step 1. Colleagues never need
  access to the sheet itself — they only ever touch the website.
- It's free and well within Google's limits for a department's volume.
- Want each addition to show **who added it**? Tell me and I'll add an optional
  "Your name" field to the Add form (the sheet already has an `addedByName` column).
