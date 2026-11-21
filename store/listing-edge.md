# Microsoft Edge Add-ons listing — Intent Tab

Copy each section into the matching field in Partner Center
(Microsoft Edge → Extensions → Create new extension).

---

## Package
Upload `../dist/intent-tab-v1.3.1.zip` (manifest.json sits at the root of the ZIP).

---

## Availability
- Visibility: **Public**
- Markets: **All markets**

---

## Properties

- **Category:** Productivity
- **Does your extension access, collect or transmit personal information?** No. Everything is stored in the browser and nothing is sent anywhere. The privacy policy URL is still filled in below.
- **Privacy policy URL:** https://saykatghosh.github.io/intent_tab/privacy.html
- **Website URL:** https://saykatghosh.github.io/intent_tab/
- **Support contact details:** https://github.com/saykatghosh/intent_tab/issues
- **Mature content:** No

---

## Store listing — English

### Display name
Intent Tab (taken from manifest.json)

### Short description
A calm new tab that asks why you opened it. Focus timer, to-dos, bookmarks bar, Ctrl+K palette and private on-device AI.

### Description (250–10,000 characters)

Open tabs on purpose, not out of habit.

Every new tab asks one gentle question: why did you open this tab? Type a reason or pick a chip, and Intent Tab shows it big with a focus timer, so you remember what you came for.

INTENT & FOCUS
• Smart asking: only after a break, always, during work hours, or never
• Focus timer: 5, 10, 25 or 50 minutes, with a 5-minute break after long sessions
• Breathing breaks: a calm orb guides you (in 4 s, hold 4 s, out 6 s)
• Focus mode (optional): while it's on, the sites you list show a calm "You're in focus mode" page, and you can always open one anyway for 5 minutes
• "Time's up" notification with Done / +5 min
• Ambient focus sounds: rain, ocean, fan

ON EVERY SITE, ONE CLICK AWAY
• Click the robot in the toolbar: a floating panel with the focus timer, today's one thing, your to-do list and focus mode, right on the page you're on
• Today's focus time is always on the toolbar icon

MEET INTENT, YOUR FOCUS BUDDY
• A tiny robot on your new tab that remembers today's one thing
• Points at your next task and offers Start or Next
• Cheers when you finish something, and its eyes follow your cursor

PLAN YOUR DAY
• Today's one thing: one goal for the day, always in view
• To-do list with daily progress and a 7-day chart
• Quick notes that save as you type
• Daily and weekly report with facts only, never guilt: tabs opened, tabs with an intent, intents finished, streak

YOUR BOOKMARKS, BETTER
• A bookmarks bar at the top of the page, with folders, drop-downs and overflow
• Right-click menu: open in a new tab, new window or private window, edit, rename, delete (with Undo), add page or folder
• Drag & drop to reorder or move into folders, and drop links from any page
• Custom icons: any emoji or your own image, plus background colours

PROJECTS AND DEVELOPER TOOLS
• Projects: tasks, progress and every link (repo, local, staging, production, design) in one place; open them all in one click
• Seven local dev tools: JSON, Base64/JWT, timestamps, colours, UUIDs, regex and units
• Search shortcuts: type mdn, npm, gh, so and more to search those sites directly

ONE SHORTCUT FOR EVERYTHING
• Ctrl+K command palette: search bookmarks, add tasks, set an intent, ask AI, change settings

PRIVATE, ON-DEVICE AI (where your browser provides a built-in model)
• Smart suggestions, an intent coach (clear goal, timer length, tiny steps), day and week summaries, and Ask AI from the search bar
• Runs on your computer: no account, no API key, nothing sent anywhere
• Works fully without AI too, using simple built-in rules

MAKE IT YOURS
• Light and dark themes, five accent colours, an animated ambient background or your own photo
• Choose your favourite search engine from a list of popular ones
• Rearrange the cards, turn modules on or off
• English and বাংলা (Bangla)

YOUR DATA STAYS YOURS
Everything is stored locally in your browser. No analytics, no tracking, no servers. You can export or import a backup at any time, and optionally sync settings, to-dos, notes and projects through your browser's own sync.

### Search terms (max 7, each up to 30 characters, 21 words in total)
1. new tab
2. focus timer
3. productivity
4. to do list
5. pomodoro
6. bookmarks bar
7. site blocker

### Store logo
`edge-logo-300.png` (300×300)

### Small promotional tile (440×280)
`promo-small-440x280.png`

### Large promotional tile (1400×560)
`promo-marquee-1400x560.png`

### Screenshots (1280×800)
- `../docs/assets/shots/1-intent-light.png`
- `../docs/assets/shots/2-cosmos-dark.png`
- `../docs/assets/shots/3-command-palette.png`
- `../docs/assets/shots/4-project-view.png`
- `../docs/assets/shots/5-focus-mode.png`

### YouTube video URL
Leave empty for now (add one when the promo video is uploaded).

---

## Notes for certification

Intent Tab replaces the new tab page. No account or login is needed, and the extension makes no network requests of its own.

How to test the main features:
1. Open a new tab. Type a reason in "Why did you open this tab?" and press Enter. The intent and a focus timer appear.
2. Focus mode: on the new tab, open Settings (the sliders icon, top right) → Focus → turn on "Focus mode". A box to add sites appears; add a site (e.g. youtube.com). The browser asks for permission for that one site. Then open the site: a calm reminder page appears instead, with an "Open anyway for 5 minutes" button.
3. Toolbar panel: open any web page and click the robot icon in the toolbar. A floating panel with the timer, today's goal and to-dos appears on that page. It does not read the page.
4. Press Ctrl+K on the new tab to open the command palette.

AI features use the browser's built-in on-device model only if one is available. When it is not, the extension uses simple built-in rules, so every feature can be tested without AI.

Permissions: optional host permissions are requested at run time only for the individual sites the user adds to focus mode.

---

## বাংলা listing (চাইলে Partner Center-এ "Bengali" ভাষা যোগ করে ব্যবহার করুন)

**ছোট বিবরণ:** শান্ত একটা নতুন ট্যাব, যা জিজ্ঞেস করে কেন খুললেন। ফোকাস টাইমার, টুডু, বুকমার্ক বার, Ctrl+K আর নিজের কম্পিউটারেই চলা AI।

**বিস্তারিত বিবরণ:**

অভ্যাসে না, উদ্দেশ্য নিয়ে ট্যাব খুলুন।

প্রতিটা নতুন ট্যাব একটা ছোট প্রশ্ন করে: কেন এই ট্যাব খুললেন? উত্তর লিখলে বা একটা চিপ বেছে নিলে Intent Tab সেটা বড় করে দেখায়, সাথে ফোকাস টাইমার। তাই মনে থাকে কী করতে এসেছিলেন।

• ফোকাস টাইমার (৫/১০/২৫/৫০ মিনিট), শ্বাসের ব্যায়াম, ফোকাস মোড, পটভূমির শব্দ (বৃষ্টি, সমুদ্র, ফ্যান)
• টুলবারের রোবটে ক্লিক করলেই যেকোনো সাইট থেকে টাইমার, আজকের লক্ষ্য, টুডু আর ফোকাস মোড
• Intent নামের ছোট্ট রোবট, যে আজকের লক্ষ্য মনে রাখে আর পরের কাজ দেখায়
• আজকের একটা লক্ষ্য, টুডু, নোট, দৈনিক আর সাপ্তাহিক রিপোর্ট
• উপরে বুকমার্ক বার: রাইট-ক্লিক মেনু, drag & drop, নিজের আইকন
• প্রজেক্ট আর ডেভেলপারদের ৭টা টুল
• Ctrl+K দিয়ে সব কিছু এক জায়গা থেকে
• ব্রাউজারের নিজের on-device AI (যেখানে পাওয়া যায়), সব ডেটা আপনার কম্পিউটারেই থাকে; AI ছাড়াও সব কিছু চলে
• লাইট/ডার্ক থিম, ৫টা রং, নিজের ছবি, ইংরেজি আর বাংলা

আপনার ডেটা শুধু আপনার ব্রাউজারেই থাকে। কোনো অ্যানালিটিক্স নেই, ট্র্যাকিং নেই, সার্ভার নেই। যখন খুশি ব্যাকআপ export বা import করতে পারেন।

**Search terms:** নতুন ট্যাব, ফোকাস টাইমার, টুডু লিস্ট, বুকমার্ক, প্রোডাক্টিভিটি
