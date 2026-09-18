import {
  add_snippet,
  delete_snippet,
  get_all_snippets,
  record_usage,
  update_snippet,
} from '../shared/storage.js';
import {
  SCOPE_LABELS,
  default_pattern,
  matches,
  parse_page,
  sort_snippets,
} from '../shared/scope.js';

const els = {
  site_label: document.querySelector('#site-label'),
  new_btn: document.querySelector('#new-btn'),
  settings_btn: document.querySelector('#settings-btn'),
  search_input: document.querySelector('#search-input'),
  editor: document.querySelector('#editor'),
  edit_title: document.querySelector('#edit-title'),
  edit_content: document.querySelector('#edit-content'),
  edit_scope: document.querySelector('#edit-scope'),
  edit_pattern: document.querySelector('#edit-pattern'),
  use_clipboard_btn: document.querySelector('#use-clipboard-btn'),
  cancel_edit_btn: document.querySelector('#cancel-edit-btn'),
  save_edit_btn: document.querySelector('#save-edit-btn'),
  list: document.querySelector('#list'),
  empty_state: document.querySelector('#empty-state'),
  empty_text: document.querySelector('#empty-text'),
};

let page = { ok: false, url: '', host: '' };
let snippets = [];
let query = '';
/** null = new snippet mode; string = editing that id. */
let editing_id = null;

function visible_snippets() {
  const matched = snippets.filter((s) => matches(s, page));
  const filtered = query
    ? matched.filter((s) => {
        const haystack = `${s.title}\n${s.content}\n${s.pattern}`.toLowerCase();
        return haystack.includes(query.toLowerCase());
      })
    : matched;
  return sort_snippets(filtered);
}

function escape_html(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function render() {
  const list = visible_snippets();
  els.list.innerHTML = '';

  if (list.length === 0) {
    els.empty_state.classList.remove('hidden');
    els.empty_text.textContent = query
      ? '没有匹配的片段'
      : page.ok
        ? '当前站点还没有片段，选中文字后右键「保存为站点片段」'
        : '当前页面无法绑定站点，可新建全局片段';
  } else {
    els.empty_state.classList.add('hidden');
  }

  for (const snippet of list) {
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.id = snippet.id;

    const preview = snippet.content.replace(/\s+/g, ' ').trim();
    row.innerHTML = `
      <div class="row-main">
        <div class="row-title">
          ${snippet.pinned ? '<span class="pin-mark">★</span>' : ''}
          <span>${escape_html(snippet.title)}</span>
        </div>
        <div class="row-preview">${escape_html(preview)}</div>
      </div>
      <span class="scope-tag ${snippet.scope_type}">${SCOPE_LABELS[snippet.scope_type]}</span>
      <span class="row-actions">
        <button class="btn act-pin" type="button" title="${snippet.pinned ? '取消置顶' : '置顶'}">${snippet.pinned ? '★' : '☆'}</button>
        <button class="btn act-edit" type="button" title="编辑">✎</button>
        <button class="btn act-delete danger" type="button" title="删除">🗑</button>
      </span>`;
    els.list.appendChild(row);
  }
}

async function refresh() {
  snippets = await get_all_snippets();
  render();
}

/** Copy must run synchronously inside the user-gesture handler. */
async function copy_snippet(snippet, row) {
  let ok = false;
  try {
    await navigator.clipboard.writeText(snippet.content);
    ok = true;
  } catch {
    // Fallback: hidden textarea + execCommand, still within the gesture.
    try {
      const ta = document.createElement('textarea');
      ta.value = snippet.content;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand('copy');
      ta.remove();
    } catch {
      ok = false;
    }
  }
  if (ok) {
    row.classList.add('copied');
    setTimeout(() => row.classList.remove('copied'), 800);
    await record_usage(snippet.id);
    await refresh();
  } else {
    window.prompt('复制失败，请手动复制：', snippet.content);
  }
}

function hide_editor() {
  editing_id = null;
  els.editor.classList.add('hidden');
}

function open_editor(snippet) {
  editing_id = snippet?.id ?? null;
  if (snippet) {
    els.edit_title.value = snippet.title;
    els.edit_content.value = snippet.content;
    els.edit_scope.value = snippet.scope_type;
    els.edit_pattern.value = snippet.pattern;
  } else {
    const { scope_type, pattern } = page.ok
      ? default_pattern(page)
      : { scope_type: 'global', pattern: '' };
    els.edit_title.value = '';
    els.edit_content.value = '';
    els.edit_scope.value = scope_type;
    els.edit_pattern.value = pattern;
  }
  sync_pattern_disabled();
  els.editor.classList.remove('hidden');
  els.edit_content.focus();
}

function sync_pattern_disabled() {
  els.edit_pattern.disabled = els.edit_scope.value === 'global';
  els.edit_pattern.placeholder =
    els.edit_scope.value === 'global' ? '全局片段无需规则' : '匹配规则';
}

async function save_editor() {
  const content = els.edit_content.value.trim();
  if (!content) {
    els.edit_content.focus();
    return;
  }
  const scope_type = els.edit_scope.value;
  const pattern = els.edit_pattern.value.trim();
  if (scope_type !== 'global' && !pattern) {
    els.edit_pattern.focus();
    return;
  }
  const title = els.edit_title.value;
  if (editing_id) {
    await update_snippet(editing_id, { title, content, scope_type, pattern });
  } else {
    await add_snippet({ title, content, scope_type, pattern });
  }
  hide_editor();
  await refresh();
}

async function get_active_tab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function bind_events() {
  els.search_input.addEventListener('input', () => {
    query = els.search_input.value.trim();
    render();
  });

  els.new_btn.addEventListener('click', () => open_editor());
  els.settings_btn.addEventListener('click', () => chrome.runtime.openOptionsPage());

  els.edit_scope.addEventListener('change', sync_pattern_disabled);
  els.cancel_edit_btn.addEventListener('click', hide_editor);
  els.save_edit_btn.addEventListener('click', () => void save_editor());

  els.use_clipboard_btn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) els.edit_content.value = text;
    } catch {
      window.alert('无法读取剪贴板，请手动粘贴');
    }
  });

  els.list.addEventListener('click', (event) => {
    const target = event.target;
    const row = target.closest('.row');
    if (!row) return;
    const snippet = snippets.find((s) => s.id === row.dataset.id);
    if (!snippet) return;

    if (target.closest('.act-delete')) {
      if (window.confirm(`删除「${snippet.title}」？`)) {
        void delete_snippet(snippet.id).then(refresh);
      }
      return;
    }
    if (target.closest('.act-pin')) {
      void update_snippet(snippet.id, { pinned: !snippet.pinned }).then(refresh);
      return;
    }
    if (target.closest('.act-edit')) {
      open_editor(snippet);
      return;
    }
    void copy_snippet(snippet, row);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !els.editor.classList.contains('hidden')) {
      hide_editor();
    }
  });
}

async function init() {
  const tab = await get_active_tab();
  page = tab?.url ? parse_page(tab.url) : parse_page('');
  els.site_label.textContent = page.ok ? page.host : '全局片段';
  els.site_label.title = page.url;
  bind_events();
  await refresh();
}

void init();
