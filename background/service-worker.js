import { add_snippet } from '../shared/storage.js';
import { default_pattern, parse_page } from '../shared/scope.js';

const MENU_ID_SAVE_SELECTION = 'save-selection';

/** Reregister on every SW start so menus survive installs / updates / restarts. */
async function register_context_menus() {
  await chrome.contextMenus.removeAll();
  await chrome.contextMenus.create({
    id: MENU_ID_SAVE_SELECTION,
    title: '保存为站点片段',
    contexts: ['selection'],
  });
}

async function flash_badge(text) {
  await chrome.action.setBadgeBackgroundColor({ color: text === '✗' ? '#c0392b' : '#2e7d32' });
  await chrome.action.setBadgeText({ text });
  // The triggering event keeps this SW alive long enough for the clear.
  setTimeout(() => {
    void chrome.action.setBadgeText({ text: '' });
  }, 1200);
}

async function save_selection(content, raw_url) {
  const trimmed = content.trim();
  if (!trimmed) {
    await flash_badge('✗');
    return;
  }
  const page = raw_url ? parse_page(raw_url) : parse_page('');
  const { scope_type, pattern } = default_pattern(page);
  const snippet = await add_snippet({ content: trimmed, scope_type, pattern });
  await flash_badge(snippet ? '✓' : '≈');
}

// Self-contained: injected via chrome.scripting, cannot reference outer scope.
function read_page_selection() {
  const el = document.activeElement;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const { selectionStart, selectionEnd, value } = el;
    if (typeof selectionStart === 'number' && typeof selectionEnd === 'number') {
      return value.slice(selectionStart, selectionEnd);
    }
  }
  return window.getSelection()?.toString() ?? '';
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID_SAVE_SELECTION) return;
  void save_selection(info.selectionText ?? '', tab?.url);
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'save-selection' || !tab?.id) return;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: read_page_selection,
    });
    const selected = results?.[0]?.result ?? '';
    await save_selection(selected, tab.url);
  } catch {
    // Restricted pages (chrome://, Web Store, ...) cannot be scripted.
    await flash_badge('✗');
  }
});

void register_context_menus();
