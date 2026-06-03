# Bodies of Work — ISH English resource library

A shared, self-sorting library of the **non-literary texts worth teaching** — ad campaigns,
speeches, opinion columns, photographs, films. A teacher drops in a link, taps the
**theme(s)** it belongs to, and it joins a browsable, filterable, searchable shelf.
No slideshow to maintain, no folder to tidy.

Built **from the department's own collection** (the *Bodies of Work* slide deck) for the ISH
English department — organised by theme, with the IB fields of inquiry as a second lens.

---

## Why there is no "AI"

The original idea was for AI to read each link and sort it. But the real pain isn't
*classifying* — it's that *organising* is a separate chore nobody has time for. So we made
**adding = organising**: when you paste a link you tap its theme(s), and a
plain **keyword suggester** (a lookup table, not an LLM) usually pre-selects them for you, so it's
just a confirm-tap. (The IB field of inquiry fills in automatically from the theme.)

The result needs **no API key, no account, no server, no cost** — it's a handful of static
files that work offline and on free hosting. Nothing to break.

---

## How a teacher uses it

1. Click **Add a resource**.
2. Paste the **link** and give it a short **title**.
3. The **theme(s)** are usually pre-suggested from the link — tap to confirm or change.
4. Optionally set the text type, mark it a **good / bad example**, add tags or a teaching note.
5. **Add to shelf** — it appears immediately (saved in your browser).

Browse with the **theme / field / text-type / example** filters on the left, or **search** titles,
tags and notes.

## How sharing works (curator model)

A static site can't write to a shared file, so additions save to *your* browser. To share one
with everyone:

1. In the Add dialog, click **Copy submission** — it copies a small JSON block.
2. Send it to the curator (whoever owns the repo).
3. The curator pastes it into the `window.SEED_RESOURCES` array in **`data.js`** and pushes.
4. GitHub Pages rebuilds and everyone sees it.

(If the department later wants instant, self-serve sharing, this can be upgraded to a tiny
serverless backend without changing the front end. Out of scope for the prototype.)

---

## Categories

- **Theme** (primary — how the department's deck is organised): Race · War · Gender ·
  Mental health · Feminism · LGBTQI+ · Environment · Inequality · Social mobility · Modernisation.
- **Field of inquiry** (secondary — IB English A: Language & Literature): Culture, identity &
  community · Beliefs, values & education · Politics, power & justice · Art, creativity & the
  imagination · Science, technology & the environment. (Auto-derived from the theme when adding.)
- **Text types**: advertisement, opinion column, speech, blog, infographic, cartoon, photograph,
  film/TV, song, website, news article, social media, poster, podcast, artwork.

The **43 resources** come straight from the department's own *Bodies of Work* deck — Katie Hopkins
columns, Peter DeVito's *Black Voices Matter*, *Two Distant Strangers*, Emma González speeches,
Edvard Munch, *It's A Sin*, *Parasite*, Steve Cutts… — every link re-checked and dead ones replaced.

---

## Run it locally

Any static server works. Two easy options:

```bash
# Node (recommended — matches the preview config)
node dev-server.cjs          # serves http://localhost:4175

# or Python
python3 -m http.server 4175  # then open http://localhost:4175
```

## Deploy to GitHub Pages

```bash
# from this folder
git init && git add . && git commit -m "Bodies of Work library"
gh repo create ish-bodies-of-work --public --source=. --push
# then enable Pages (Settings → Pages → branch: main / root), or via API
```

## Tests

End-to-end Playwright suite (load, filter, search, suggester, add, persistence, duplicate
guard, XSS safety, keyboard a11y, responsive). Start the server, then:

```bash
node tests/library.test.cjs   # 28 assertions
```

## Files

| File | Purpose |
|------|---------|
| `index.html` | Structure (semantic, native `<dialog>` modal) |
| `styles.css` | Dark editorial theme (Cormorant Garamond + gold) |
| `app.js` | All behaviour — render, filter, search, add, localStorage, suggester |
| `data.js` | The master shelf — `window.SEED_RESOURCES` (curator edits this) |
| `tests/library.test.cjs` | End-to-end tests |
| `dev-server.cjs` | Local static server (not deployed) |
