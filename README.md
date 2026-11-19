# Intent Tab

A calm Chrome new tab page that asks one question: **“Why did you open this tab?”**
It helps you notice tabs opened from habit. Everything is stored locally in
`chrome.storage.local`. There is no server, no account and no tracking.

Plain HTML, CSS and vanilla JavaScript (ES modules). No build step.

## Install (Load unpacked)

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select this folder (the one that contains `manifest.json`).
5. Open a new tab. If Chrome asks whether to keep the changed new tab page, choose **Keep it**.

After editing any file, click the reload icon on the extension card in `chrome://extensions`, then open a new tab.

### ইনস্টল (বাংলায়)

1. Chrome-এ `chrome://extensions` খুলুন।
2. উপরে ডানদিকের **Developer mode** চালু করুন।
3. **Load unpacked** চাপুন।
4. এই ফোল্ডারটা (যেখানে `manifest.json` আছে) সিলেক্ট করুন।
5. নতুন ট্যাব খুলুন। Chrome যদি জিজ্ঞেস করে নতুন ট্যাব পেজ রাখবেন কিনা, **Keep it** চাপুন।

## Features

- **Intent question:** type a reason or pick a chip (Check email, Research, Take a break, Not sure). The intent is then shown large with a 10-minute focus timer and **Done** / **New intent** buttons. The top line shows which tab of the day this is.
- **When to ask** (Settings):
  - **Smart** (default): asks on the first tab after a break of more than 10 minutes. If an intent is running, it is shown instead of the question.
  - **Always:** asks on every new tab, with a “Continue: …” chip for the running intent.
  - **Work hours:** like Smart, but only between the times you set.
  - **Off:** never asks. You can still click “Set an intent”.
  - “Don’t ask for 1 hour” and “Not today” pause the question. **Esc** dismisses it. It never blocks the page, and the search bar always works.
- **To-do list:** add, tick and delete tasks. Shows a progress bar for today and a bar chart of the last 7 days. Tasks finished on earlier days are cleared automatically; unfinished tasks carry over.
- **Bookmarks bar:** a bar at the very top of the page shows everything from Chrome’s Bookmarks bar, with icons. Click a folder to open a drop-down; sub-folders open inside it (use ‹ to go back, arrow keys to move). Items that don’t fit go into the **»** menu. **Other bookmarks** / **Mobile bookmarks** sit on the right.
  - **Hide Chrome’s own bar:** extensions cannot hide it, but you can: press **Ctrl+Shift+B** (Chrome menu → Bookmarks and lists → Show bookmarks bar). A one-time tip on the page reminds you.
  - **Add a bookmark:** click **+** in the bar (saves to the Bookmarks bar), or **Add bookmark here** at the bottom of any folder menu. Enter a URL (`example.com` is enough) and an optional name, then click **Save**.
  - **Right-click menu (like Chrome’s):** right-click any bookmark or folder in the bar or in a folder menu (or use the ⋯ button in folder menus):
    - Bookmark: Open in new tab / new window / Incognito window, **Edit…** (name and URL), Change icon…, Copy link, **Delete**, Add page…, Add folder…, Bookmark manager.
    - Folder: Open all (N) / in new window / in Incognito window, **Rename…**, Change icon…, **Delete** (with everything inside), Add page…, Add folder…, Bookmark manager.
    - After a delete, the toast at the bottom offers **Undo** for 7 seconds. It restores the item in its old place, with everything inside and its custom icons.
    - Chrome’s root folders (Bookmarks bar, Other bookmarks) can’t be renamed or deleted.
  - **Drag & drop (like Chrome):**
    - Drag a bookmark or folder along the bar to reorder it; a line shows where it will land.
    - Drop it on the middle of a folder to move it inside (the folder highlights).
    - Hold it over a folder (or **»**) for a moment and the folder opens, so you can drop it anywhere inside, including sub-folders.
    - Reorder inside folder menus too, or drag items from a menu back onto the bar.
    - Drag a link from any web page (or the address bar) onto the bar or into a folder menu to bookmark it.
  - **Most visited tiles** have a right-click menu too: open in new tab / window / Incognito, change icon, copy link, add to bookmarks bar.
  - **Create a folder:** click **+** and switch to **Folder**, or choose **New folder here** at the bottom of any folder menu (folders can be nested). Give it a name and click **Save**. It is a real Chrome bookmark folder, so it also appears in Chrome’s Bookmark manager.
  - You can also add one the usual Chrome way: press **Ctrl+D** (or the ☆ star in the address bar) on any page and choose **Bookmarks bar** as the folder.
  - Changes made in Chrome’s Bookmark manager (`Ctrl+Shift+O`) show up on the page immediately, and the other way round.
  - **Custom icons:** right-click any bookmark or folder in the bar, or any most-visited tile (in folder menus and on tiles you can also hover and click the small ✎ button). Pick an emoji, type any emoji, or upload your own image, and choose a background colour. **Reset** brings back the original icon.
  - **Emoji in a name becomes the icon:** if a bookmark or folder name starts with an emoji (e.g. `📁 Work`, `🎵 Music`), Intent Tab shows that emoji as its icon and hides it from the name, so you never see two icons side by side.
  - **Chrome’s bookmark bar:** Chrome does not let extensions change the icons in its own bar. In the icon dialog, tick **“Also show this emoji in Chrome’s bookmark bar”** and the emoji is added to the start of the bookmark’s name (for example `🎨 Design`), so it shows in the bar too. Choosing another emoji or **Reset** updates or removes it again. On the Intent Tab page itself the name is shown without the extra emoji.
- **Most visited:** from `chrome.topSites`.
- **Google search bar and clock.** Press **/** anywhere to jump to the search bar.
- **Report** (Today / Yesterday / Week): tabs opened, the share of tabs that had an intent, intents completed, open tabs right now, and your streak (days in a row with a finished intent). **Week** adds a 7-day chart (tabs with an intent vs. other tabs) and an AI week summary. Facts only, never judgement.
- **Notes:** a small scratchpad card that saves as you type (also from the palette: “Add to notes: …”).
- **Rearrange cards:** hover a card (To-do, Notes, Report) and drag its ⠿ handle to move it within or between the left and right columns. **Settings → Your data → Reset card layout** puts them back.
- **Focus mode** (Settings → Focus): add sites such as `youtube.com`. While an intent is running, visiting them shows a calm page (“youtube.com can wait.”) with your intent and the time left, plus **Back to my intent** and **Open anyway for 5 min**. Chrome asks once for permission for each site you add; nothing else is read or blocked. Breaks never trigger it.
- **Notifications:** when the focus timer ends, a “Time’s up” notification appears with **Done** and **+5 min** (works even when no Intent Tab page is open). Turn it off in Settings → Focus.
- **Focus sounds:** under a running intent’s timer, choose **Rain**, **Ocean** or **Fan** (plus volume). The sounds are generated live with Web Audio (no audio files), keep playing while you work in other tabs, and stop when the timer ends.
- **Search engine:** Settings → Search engine: Google, Bing, DuckDuckGo, Brave Search, YouTube, Perplexity or ChatGPT. Used by the search bar, the palette and Ask AI’s “search instead” link.
- **Accent colour:** Sage (default), Ocean, Violet, Amber or Rose, in light and dark.
- **Background photo:** Settings → Background → **Photo** → *Choose a photo…*, with a **Darken** slider. The photo is resized and stored locally.
- **Your data:** **Export backup** downloads everything as a JSON file; **Import backup** restores it. **Sync settings** copies your settings (not to-dos, notes or history) through Chrome sync to your other computers.
- **For developers**
  - **Search shortcuts:** in the search bar or Ctrl+K, type a keyword, a space and your query: `mdn`, `npm`, `gh` (`gh owner/repo` opens the repo), `so` (Stack Overflow), `can` (Can I use), `dd` (DevDocs), `pypi`, `crates`, `bundle` (Bundlephobia), `tw` (Tailwind), `yt`, `w` (Wikipedia). A hint shows where Enter will go.
  - **Projects:** Settings → Developer → *Projects…* (or Ctrl+K → “Manage projects”). Keep each project’s links together — Repo, Local (`localhost:3000` works), Staging, Production, Design, Tracker. Type the project name in Ctrl+K to open one link, or “Open all” in new tabs.
  - **Developer tools** (Ctrl+K or Settings → Developer → *Developer tools…*), all local:
    **JSON** format / minify / validate · **Encode** Base64, URL, JWT decode (with iat/exp as dates) · **Timestamp** ↔ date (local, ISO, UTC, relative) · **Color** HEX / RGB / HSL / OKLCH + WCAG contrast on white/black · **Generate** UUID v4 and strong passwords · **Regex** tester with highlighted matches and groups · **Units** px ↔ rem, bytes (KB/KiB…), time zones.
  - **Instant answers in Ctrl+K:** type `2*(3+4)` → = 14, `1732032000` → the date, `#7fd6bd` → RGB/OKLCH, `24px` → 1.5rem, a JWT → decode it, JSON → format it. Enter copies or opens the tool.
- **Welcome tour:** three short steps on first run (also in the palette: “Show the welcome tour”).
- **Command palette — Ctrl+K (⌘K on Mac):** or click **Search** in the top bar. Type to:
  set an intent, ask the AI, add a to-do, set today’s one thing, or search Google;
  find any bookmark (all folders); tick/untick to-dos; mark the intent done, add time or change the timer;
  start a breathing break; change theme, language or background; open settings. ↑↓ to move, Enter to run, Esc to close.
- **Today’s one thing:** above the question, set one goal for the day (“What would make today a good day?”). It stays as a small pill with ✓ (done) and ✎ (change), and the AI suggestions and coach take it into account. “Skip today” hides it until tomorrow.
- **Timer length:** Settings → Focus timer: 5, 10 (default), 25 or 50 minutes. Under a running intent’s timer you can switch between them. After a session of 20+ minutes, **Take a 5-min break** appears.
- **Breathing breaks:** choosing **Take a break** (or a 5-min break) shows a calm breathing orb — breathe in 4 s, hold 4 s, breathe out 6 s — with a 5-minute timer. With reduced motion, only the words change.
- **On-device AI** (Chrome’s built-in Gemini Nano via the Prompt API — runs locally, no API key, no server, nothing leaves the computer):
  - **Smart suggestions:** under the question, “✦ Suggested” chips based on your open tasks, recent intents and the time of day.
  - **AI coach:** after you set an intent, it rewrites it as one clear goal, suggests a realistic timer length (**Set timer to N min**) and 2–3 tiny steps (**Add steps to to-do**). For “Not sure” it offers concrete things to pick instead.
  - **Day summary:** a short, neutral summary in the report card (↻ to rewrite it). Cached; today’s is refreshed at most every 30 minutes unless you press ↻.
  - **Ask AI:** type a question in the search bar and press **Tab** (or click **✦ Ask AI**) to get an answer right on the page. **Enter** still searches Google.
  - **Settings → AI (on this device):** turn AI on/off, see the model status, and start the one-time model download. A glowing **✦ AI** badge in the top bar shows it is ready (and spins while it is thinking).
  - **Without the model** (unsupported device, not downloaded yet, or AI turned off) everything still works with simple built-in rules: suggestions from your tasks and habits, timer lengths by topic, and a facts-only summary.
  - Requirements come from Chrome: a recent desktop Chrome on Windows, macOS, Linux or ChromeOS, plenty of free disk space for the model, and a capable GPU or enough RAM. AI replies are in English for now.
- **Ambient background:** soft colour fields drift slowly behind the page, with gentle wave lines near the bottom and a light paper grain. The colours follow the time of day (morning, day, evening, night) and the light/dark theme. In Settings → Background choose **Animated** (default), **Still** (no motion) or **Plain**. The animation pauses while the tab is hidden and stays still if the system asks for reduced motion.
- **Visual effects:** soft cross-fades between views, themes and languages; the question and your intent appear word by word; a small particle burst when you mark an intent Done or finish every task; animated strike-through, slide-in and fold-away for tasks; chart bars that grow in; report numbers that count up; a cursor spotlight on cards; and a ripple on buttons. All motion turns off when the system asks for reduced motion.
- **Settings panel:** turn modules on or off, choose the ask mode, the background, the language and the theme (System / Light / Dark).

## Permissions

| Permission  | Why |
|-------------|-----|
| `storage`   | Save settings, intents, to-dos, notes and daily counts locally (settings in Chrome sync only if you turn sync on) |
| `bookmarks` | Show your bookmarks and let you add, edit, move and delete them from the page |
| `favicon`   | Show site icons via `chrome-extension://<id>/_favicon/` |
| `topSites`  | Show most visited sites |
| `alarms`    | Wake up when the focus timer ends (notification, end focus mode) |
| `notifications` | “Time’s up” notification |
| `declarativeNetRequest` | Focus mode: redirect only the sites you listed, only while an intent runs |
| `offscreen` | Play the optional focus sounds in the background |
| optional `*://*/*` | Asked **per site** when you add it to focus mode — never otherwise |

No analytics and no network requests of its own. The search form opens results from the engine you chose, in the tab.

## Files

```
manifest.json
newtab.html
background.js      service worker: focus-mode rules, timer notification, focus sounds
offscreen.html/.js generates the focus sounds (Web Audio)
blocked.html/.js   the calm page shown by focus mode
store/             Chrome Web Store texts, privacy policy, screenshots, promo tiles (not part of the package)
css/newtab.css
js/strings.js      all UI text, English (en) and Bangla (bn)
js/store.js        storage helpers, constants (timer length, break length)
js/intent.js       question / running intent / timer / ask-mode rules
js/todos.js        to-do list and 7-day chart
js/bookmarks.js    bookmarks grid and most visited
js/report.js       daily report
js/settings.js     settings panel
js/app.js          boot, theme, clock, module switching
js/background.js   ambient canvas background (with gentle mouse parallax)
js/palette.js      command palette (Ctrl+K); modules add commands with registerCommands()
js/focus.js        today's one thing
js/breathe.js      breathing guide for breaks
js/ai.js           on-device AI wrapper (Chrome Prompt API / Gemini Nano)
js/assistant.js    AI features: suggestions, coach, summary, Ask AI (+ rule fallbacks)
js/contextmenu.js  the right-click menu
js/icons.js        custom tile icons (emoji / image / colour) and the icon dialog
js/effects.js      shared visual effects: view transitions, word reveal,
                   count-up numbers, particle burst, ripple, card spotlight
js/prefs.js        search engine, accent, photo, focus sites, notifications, sync, export/import, sounds
js/search.js       search engines
js/notes.js        notes card
js/layout.js       drag cards between columns
js/onboarding.js   welcome tour
js/projects.js     project switcher (links per project)
js/tools.js        developer tools + instant answers in the palette
js/theme-boot.js   sets the theme (and accent) before first paint
scripts/build.mjs  check / bump / zip (no dependencies)
.github/workflows/ CI: check + build on every push
fonts/             Inter + Instrument Serif (latin, WOFF2, OFL) — bundled, no web requests
icons/             16, 48, 128 px
```

## Development

No dependencies — just Node 18+.

```bash
npm run check          # manifest, JS syntax, imports, element ids, en/bn strings
npm run build          # check, then dist/intent-tab-v<version>.zip (only what Chrome needs)
npm run bump:patch     # 1.3.0 → 1.3.1   (also bump:minor, bump:major)
npm run release        # bump patch + check + zip in one go
```

(Or run `node scripts/build.mjs …` directly.) The ZIP leaves out `store/`, `scripts/`, `.git`, `.github`, `package.json` and the README.

**Git & CI:** the folder is a Git repository (`main`). `.github/workflows/build.yml` runs the same check and build on every push and pull request once the repo is on GitHub, and attaches the ZIP to the run.

## Publishing to the Chrome Web Store

Everything you need is in `store/`:

- `store/listing.md` — name, short and detailed description (English + বাংলা), category, single purpose, a justification for every permission, and the data-usage answers.
- `store/privacy-policy.md` — publish it at a public URL (for example GitHub Pages or Google Sites) and paste that URL into the **Privacy** tab. Add your contact email at the bottom first.
- `store/screenshots/*.png` (1280×800), `store/promo-small-440x280.png`, `store/promo-marquee-1400x560.png`, and `icons/icon128.png` as the store icon.

Upload `dist/intent-tab-v<version>.zip` from `npm run build` (it already leaves out `store/`). Raise the version (`npm run bump:patch`) before every new upload.

## Language: English / বাংলা

The page comes in English and Bangla. Switch between them in **Settings → Language**. The change applies immediately, and numbers and dates also switch to Bangla digits. English is the default.

All visible text lives in `js/strings.js`, in the `en` and `bn` blocks. To change wording, edit it there. To add a third language, copy the `en` block, translate it, add its locale to `LOCALES` and add a button in the Language section of `newtab.html`.

## Stored data

`chrome.storage.local` keys: `settings`, `intent`, `ask` (last tab time and snooze), `todos`, `notes`, `focus` (today’s one thing), `focusAllow` (sites opened “anyway” for 5 minutes), `projects`, `sound`, `bgPhoto`, `icons` (custom tile icons), `history` (recent intents, for suggestions and summaries), `aiCache` (cached AI suggestions and summaries), `ui`, and `days` (per-day counts, kept for 60 days). Removing the extension deletes all of it.
