# Intent Tab — Privacy Policy

_Last updated: November 22, 2026_

Intent Tab is a browser extension for Google Chrome and Microsoft Edge that replaces the new tab page. This policy explains what happens to your information when you use it.

## The short version
**Intent Tab does not collect, send, sell or share any of your data.** It has no servers, no accounts, no analytics and no tracking. Everything stays in your browser.

## What is stored, and where
Intent Tab saves the following **only on your computer**, in your browser's extension storage (`chrome.storage.local`):

- your settings (theme, language, timer length, search engine, and so on)
- the intents you type, your daily goal, to-dos, notes and projects
- simple daily counts (tabs opened, tabs with an intent, intents completed, focus time)
- custom bookmark icons and an optional background photo you choose
- cached AI suggestions and summaries

You can delete all of it at any time by removing the extension. You can also export it to a file, or import it from one, in **Settings → Your data**.

**Optional sync:** if you turn on sync in **Settings**, your settings, to-dos, notes and projects are copied to your browser's own sync (`chrome.storage.sync`). In Chrome, Google handles this under your Google account and Google's privacy terms. In Microsoft Edge, Microsoft handles it under your Microsoft account and Microsoft's privacy statement. Intent Tab itself still sends nothing anywhere. History and your background photo are never synced. Turning sync off stops all copying.

## Bookmarks, most visited and tabs
Intent Tab reads your bookmarks and most-visited sites **only to display them on the new tab page**, and changes bookmarks **only when you ask it to** (add, edit, rename, move, delete). It counts open tabs to show the number; it does not read tab addresses or contents.

## Toolbar panel
When you click the Intent Tab icon in the toolbar, Intent Tab shows its panel over the page you are on (using the browser's `activeTab` permission, only for that click). The panel is part of the extension; Intent Tab does not read, store or send anything from the page.

## Focus mode
If you turn on focus mode and add sites (for example `youtube.com`), your browser asks you to allow Intent Tab access to **those sites only**. While focus mode is on, visits to those sites are redirected to a calm reminder page inside the extension. Intent Tab does not read, store or send the pages you visit.

## On-device AI
AI features use **the browser's own built-in, on-device model** where the browser provides one (in Chrome, this is Gemini Nano). It runs on your computer. Prompts and answers are processed locally by the browser and are not sent to Intent Tab or to any other server by this extension. If your browser or device has no such model, simple built-in rules are used instead. You can turn AI features off in Settings.

## Search
The search bar sends your query to the search engine you choose (Google by default), the same way typing into that site would. Intent Tab does not see or keep these searches.

## Update check (ZIP installs only)
If you installed Intent Tab from the ZIP file rather than from the Chrome Web Store or Microsoft Edge Add-ons, it asks GitHub (`api.github.com`) once a day for the latest version number, so it can tell you when an update is out. Nothing about you or your data is sent; GitHub sees an ordinary web request under its own privacy statement. Copies installed from either store never do this, because the browser updates them.

## Children
Intent Tab is not directed at children and collects no personal information from anyone.

## Changes
If this policy changes, the new version will be published with an updated date.

## Contact
Questions about this policy: open an issue on GitHub: https://github.com/saykatghosh/intent_tab/issues
