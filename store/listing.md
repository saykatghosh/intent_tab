# Chrome Web Store listing — Intent Tab

Copy each section into the matching field in the Developer Console.

---

## Name
Intent Tab

## Short description (max 132 characters)
A calm new tab that asks why you opened it. Focus timer, to-dos, bookmarks bar, Ctrl+K palette and private on-device AI.

## Category
Productivity → Workflow & Planning

## Language
English (also includes a full Bangla interface)

---

## Detailed description

Open tabs on purpose, not out of habit.

Every new tab asks one gentle question: **why did you open this tab?** Type a reason or pick a chip, and Intent Tab shows it big with a focus timer, so you remember what you came for.

**Intent & focus**
• Smart asking: only after a break, always, during work hours, or never
• Focus timer: 5, 10, 25 or 50 minutes, with a 5-minute break after long sessions
• Breathing breaks: a calm orb guides you (in 4 s, hold 4 s, out 6 s)
• Focus mode (optional): sites you choose show a calm reminder while your intent runs, and you can always open them anyway
• "Time's up" notification with Done / +5 min
• Ambient focus sounds: rain, ocean, fan

**Plan your day**
• Today's one thing: one goal for the day, always in view
• To-do list with daily progress and a 7-day chart
• Quick notes that save as you type
• Daily and weekly report with facts only, never guilt: tabs opened, tabs with an intent, intents finished, streak

**Your bookmarks, better**
• A bookmarks bar at the top of the page, with folders, drop-downs and overflow
• Right-click like Chrome: open in new tab or window or Incognito, edit, rename, delete (with Undo), add page or folder
• Drag & drop to reorder or move into folders, and drop links from any page
• Custom icons: any emoji or your own image, plus background colours

**One shortcut for everything**
• Ctrl+K command palette: search bookmarks, add tasks, set an intent, ask AI, change settings

**Private, on-device AI** (Chrome's built-in Gemini Nano, where available)
• Smart suggestions, an intent coach (clear goal, timer length, tiny steps), day and week summaries, and Ask AI from the search bar
• Runs on your computer: no account, no API key, nothing sent anywhere
• Works without AI too, using simple built-in rules

**Make it yours**
• Light and dark themes, five accent colours, an animated ambient background or your own photo
• Choose your search engine: Google, Bing, DuckDuckGo, Brave, YouTube, Perplexity or ChatGPT
• Rearrange the cards, turn modules on or off
• English and বাংলা (Bangla)

**Your data stays yours**
Everything is stored locally in your browser. No analytics, no tracking, no servers. You can export or import a backup at any time, and optionally sync settings, to-dos, notes and projects through Chrome sync.

---

## Website and privacy policy URL
- Website: https://saykatghosh.github.io/intent_tab/
- Privacy policy (paste into the Privacy tab): https://saykatghosh.github.io/intent_tab/privacy.html

Both go live once GitHub Pages is turned on for the `docs/` folder.

---

## Single purpose (Privacy practices tab)
Intent Tab replaces the new tab page with a calm start page that helps people open tabs with a clear intention, using a focus timer, to-dos, bookmarks and optional on-device AI.

## Permission justifications

| Permission | Justification |
|---|---|
| `storage` | Saves the user's settings, intents, to-dos, notes, custom icons and daily counts locally (and settings, to-dos, notes and projects in Chrome sync if the user turns sync on). |
| `bookmarks` | Shows the user's bookmarks in the page's bookmarks bar and lets the user add, edit, rename, move and delete them from there. |
| `favicon` | Shows website icons next to bookmarks and most-visited sites, using Chrome's built-in favicon cache. |
| `topSites` | Shows the user's most visited sites on the new tab page. |
| `alarms` | Wakes the extension when the user's focus timer ends, to show the notification and to end focus mode on time. |
| `notifications` | Shows a "Time's up" notification when the focus timer ends (can be turned off in settings). |
| `declarativeNetRequest` | Focus mode: while the user's intent is running, redirects only the sites the user has listed to a calm reminder page inside the extension. No page content is read. |
| `offscreen` | Plays optional ambient focus sounds (rain, ocean, fan), generated with Web Audio, while the user works in other tabs. |
| Optional host permissions (`*://*/*`) | Requested at run time for each individual site the user adds to focus mode (for example youtube.com), so that only those sites can be redirected. Never requested otherwise. |

**Remote code:** No. All code is included in the package.

**Data usage:** The extension does not collect or transmit any user data. Tick "I do not sell or transfer user data to third parties…" and leave every data type unchecked.

---

## Store graphics (in this folder)
- `../docs/assets/shots/1-intent-light.png` (1280×800)
- `../docs/assets/shots/2-cosmos-dark.png` (1280×800)
- `../docs/assets/shots/3-command-palette.png` (1280×800)
- `../docs/assets/shots/4-project-view.png` (1280×800)
- `../docs/assets/shots/5-focus-mode.png` (1280×800)
- `promo-small-440x280.png`: small promo tile
- `promo-marquee-1400x560.png`: marquee promo tile
- Store icon: use `../icons/icon128.png`

---

## বাংলা বিবরণ (চাইলে বাংলা listing-এ ব্যবহার করুন)

**ছোট বিবরণ:** শান্ত একটা নতুন ট্যাব, যা জিজ্ঞেস করে কেন খুললেন। ফোকাস টাইমার, টুডু, বুকমার্ক বার, Ctrl+K আর নিজের কম্পিউটারেই চলা AI।

**বিস্তারিত:**
অভ্যাসে না, উদ্দেশ্য নিয়ে ট্যাব খুলুন। প্রতিটা নতুন ট্যাব একটা ছোট প্রশ্ন করে: কেন এই ট্যাব খুললেন? উত্তর দিলে সেটা বড় করে দেখায়, সাথে ফোকাস টাইমার।

• ফোকাস টাইমার (৫/১০/২৫/৫০ মিনিট), শ্বাসের ব্যায়াম, ফোকাস মোড, পটভূমির শব্দ
• আজকের একটা লক্ষ্য, টুডু, নোট, দৈনিক আর সাপ্তাহিক রিপোর্ট
• উপরে বুকমার্ক বার: রাইট-ক্লিক মেনু, drag & drop, নিজের আইকন
• Ctrl+K দিয়ে সব কিছু এক জায়গা থেকে
• Chrome-এর নিজের Gemini Nano দিয়ে AI, সব ডেটা আপনার কম্পিউটারেই থাকে
• লাইট/ডার্ক থিম, ৫টা রং, নিজের ছবি, ইংরেজি আর বাংলা
