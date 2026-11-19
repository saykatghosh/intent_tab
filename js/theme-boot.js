// Runs before first paint to avoid a light/dark flash.
// chrome.storage is async, so the chosen theme is mirrored into localStorage.
try {
  const theme = localStorage.getItem('intent-theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  const accent = localStorage.getItem('intent-accent');
  if (accent && accent !== 'sage') document.documentElement.dataset.accent = accent;
} catch (e) { /* ignore */ }
