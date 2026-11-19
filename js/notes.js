// Quick notes: a small scratchpad that saves itself as you type.

import { get, set } from './store.js';
import { t } from './strings.js';
import { registerCommands } from './palette.js';

const $ = (id) => document.getElementById(id);
let started = false;
let timer = 0;

function autosize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(320, Math.max(84, el.scrollHeight)) + 'px';
}

function status(key) {
  const s = $('notesStatus');
  s.textContent = key ? t(key) : '';
  s.classList.toggle('is-on', !!key);
}

export async function initNotes() {
  if (started) return;
  started = true;
  const area = $('notesArea');
  const { notes = { text: '' } } = await get('notes');
  area.value = notes.text || '';
  autosize(area);

  area.addEventListener('input', () => {
    autosize(area);
    status('notesSaving');
    clearTimeout(timer);
    timer = setTimeout(async () => {
      await set({ notes: { text: area.value, updatedAt: Date.now() } });
      status('notesSaved');
      setTimeout(() => status(''), 1400);
    }, 400);
  });

  // Edited in another tab: update here unless you're typing.
  chrome.storage.onChanged.addListener((c, a) => {
    if (a !== 'local' || !c.notes || document.activeElement === area) return;
    area.value = (c.notes.newValue && c.notes.newValue.text) || '';
    autosize(area);
  });

  registerCommands((q) => [{
    group: 'actions', icon: 'plus', label: q ? t('palAddNote', { q }) : t('palOpenNotes'), always: false,
    keywords: 'note notes scratchpad write নোট',
    run: async () => {
      if (q) {
        area.value = area.value ? `${area.value.replace(/\s+$/, '')}\n${q}` : q;
        area.dispatchEvent(new Event('input'));
      }
      area.focus();
      area.setSelectionRange(area.value.length, area.value.length);
    },
  }]);
}
