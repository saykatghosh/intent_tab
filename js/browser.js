// Which browser is this? Microsoft Edge runs the same extension code as
// Chrome, but some names differ (InPrivate, favorites bar, edge:// pages),
// so the UI uses this to say the right thing.

const nav = globalThis.navigator || {};
const brands = nav.userAgentData?.brands || [];

export const IS_EDGE =
  brands.some((b) => b.brand === 'Microsoft Edge') || /\bEdg\//.test(nav.userAgent || '');

// The browser's own new tab page: chrome://newtab/ or edge://newtab/
export function newTabUrl() {
  return IS_EDGE ? 'edge://newtab/' : 'chrome://newtab/';
}

// The bookmarks manager, optionally opened at a folder.
// Edge calls it "Favorites" and lives at edge://favorites/.
export function bookmarksManagerUrl(folderId) {
  const base = IS_EDGE ? 'edge://favorites/' : 'chrome://bookmarks/';
  return folderId ? `${base}?id=${folderId}` : base;
}
