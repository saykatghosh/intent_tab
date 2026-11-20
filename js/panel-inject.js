// Injected into the current page when the toolbar icon is clicked.
// Shows popup.html as a floating panel in the top-right corner (a transparent
// frame, so the rounded panel and the robot holding its edge float over the
// page). Clicking the icon again, pressing Esc or clicking the page closes it.
(() => {
  const ID = 'intent-tab-panel-frame';
  const old = document.getElementById(ID);
  if (old) { old.__close(); return; }

  const origin = new URL(chrome.runtime.getURL('/')).origin;
  const frame = document.createElement('iframe');
  frame.id = ID;
  frame.src = chrome.runtime.getURL('popup.html?embed=1');
  frame.title = 'Intent Tab';
  frame.setAttribute('allowtransparency', 'true');
  const css = {
    all: 'initial', position: 'fixed', top: '8px', right: '14px', zIndex: '2147483647',
    width: '404px', height: '640px', maxHeight: 'calc(100vh - 16px)',
    border: '0', background: 'transparent', colorScheme: 'normal', display: 'block',
    opacity: '0', transform: 'translateY(-8px) scale(.98)', transformOrigin: 'top right',
    transition: 'opacity .2s ease, transform .25s cubic-bezier(.2,.8,.2,1)',
  };
  Object.assign(frame.style, css);

  function onMessage(e) {
    if (e.origin !== origin || e.source !== frame.contentWindow || !e.data) return;
    if (e.data.intentTabPanel === 'close') close();
    if (e.data.intentTabPanel === 'size' && e.data.h > 0) frame.style.height = Math.min(e.data.h, window.innerHeight - 16) + 'px';
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  function onDown(e) { if (e.target !== frame) close(); }

  function close() {
    window.removeEventListener('message', onMessage);
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('mousedown', onDown, true);
    frame.style.opacity = '0';
    frame.style.transform = 'translateY(-8px) scale(.98)';
    setTimeout(() => frame.remove(), 220);
  }
  frame.__close = close;

  window.addEventListener('message', onMessage);
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('mousedown', onDown, true);
  (document.body || document.documentElement).append(frame);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    frame.style.opacity = '1';
    frame.style.transform = 'none';
  }));
})();
