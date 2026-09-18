import {
  delete_snippet,
  get_all_snippets,
  is_snippet_array,
  replace_all,
  update_snippet,
} from '../shared/storage.js';
import { SCOPE_LABELS, sort_snippets } from '../shared/scope.js';

const els = {
  export_btn: document.querySelector('#export-btn'),
  import_btn: document.querySelector('#import-btn'),
  import_file: document.querySelector('#import-file'),
  search_input: document.querySelector('#search-input'),
  scope_filter: document.querySelector('#scope-filter'),
  count_label: document.querySelector('#count-label'),
  tbody: document.querySelector('#tbody'),
  empty_state: document.querySelector('#empty-state'),
  dialog: document.querySelector('#edit-dialog'),
  dialog_title: document.querySelector('#dialog-title'),
  edit_title: document.querySelector('#edit-title'),
  edit_content: document.querySelector('#edit-content'),
  edit_scope: document.querySelector('#edit-scope'),
  edit_pattern: document.querySelector('#edit-pattern'),
  edit_pinned: document.querySelector('#edit-pinned'),
};

let snippets = [];
let editing_id = null;

function escape_html(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function filtered_snippets() {
  const q = els.search_input.value.trim().toLowerCase();
  const scope = els.scope_filter.value;
  let list = sort_snippets(snippets);
  if (scope) list = list.filter((s) => s.scope_type === scope);
  if (q) {
    list = list.filter((s) =>
      `${s.title}\n${s.content}\n${s.pattern}`.toLowerCase().includes(q),
    );
  }
  return list;
}

function render() {
  const list = filtered_snippets();
  els.tbody.innerHTML = '';
  els.empty_state.classList.toggle('hidden', list.length > 0);
  els.count_label.textContent = `${list.length} / ${snippets.length} 条`;

  for (const s of list) {
    const tr = document.createElement('tr');
    tr.dataset.id = s.id;
    tr.innerHTML = `
      <td class="col-title">${s.pinned ? '★ ' : ''}${escape_html(s.title)}</td>
      <td><span class="scope-tag">${SCOPE_LABELS[s.scope_type]}</span></td>
      <td><div class="cell-pattern">${escape_html(s.pattern)}</div></td>
      <td><div class="cell-content" title="${escape_html(s.content)}">${escape_html(s.content)}</div></td>
      <td class="col-meta">${s.usage_count}</td>
      <td>
        <div class="row-actions">
          <button class="btn act-edit" type="button">编辑</button>
          <button class="btn act-delete danger" type="button">删除</button>
        </div>
      </td>`;
    els.tbody.appendChild(tr);
  }
}

async function refresh() {
  snippets = await get_all_snippets();
  render();
}

function open_dialog(snippet) {
  editing_id = snippet.id;
  els.dialog_title.textContent = '编辑片段';
  els.edit_title.value = snippet.title;
  els.edit_content.value = snippet.content;
  els.edit_scope.value = snippet.scope_type;
  els.edit_pattern.value = snippet.pattern;
  els.edit_pinned.checked = snippet.pinned;
  sync_pattern_state();
  els.dialog.showModal();
}

function sync_pattern_state() {
  els.edit_pattern.disabled = els.edit_scope.value === 'global';
}

async function handle_dialog_close() {
  if (els.dialog.returnValue !== 'save' || !editing_id) return;
  const content = els.edit_content.value.trim();
  if (!content) {
    window.alert('内容不能为空');
    return;
  }
  const scope_type = els.edit_scope.value;
  const pattern = els.edit_pattern.value.trim();
  if (scope_type !== 'global' && !pattern) {
    window.alert('非全局片段必须填写规则');
    return;
  }
  await update_snippet(editing_id, {
    title: els.edit_title.value,
    content,
    scope_type,
    pattern,
    pinned: els.edit_pinned.checked,
  });
  await refresh();
}

async function export_json() {
  const blob = new Blob([JSON.stringify(snippets, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `site-snippets-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function import_json(file) {
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    window.alert('文件不是合法 JSON');
    return;
  }
  if (!is_snippet_array(parsed)) {
    window.alert('JSON 结构不符合片段格式');
    return;
  }
  const replace = window.confirm(
    `导入 ${parsed.length} 条片段。\n确定 = 覆盖现有片段；取消 = 合并（保留现有片段）。`,
  );
  if (replace) {
    await replace_all(parsed);
  } else {
    const existing = new Set(
      snippets.map((s) => `${s.content}|${s.scope_type}|${s.pattern}`),
    );
    const merged = [...snippets];
    for (const incoming of parsed) {
      const key = `${incoming.content}|${incoming.scope_type}|${incoming.pattern}`;
      if (!existing.has(key)) {
        existing.add(key);
        merged.push(incoming);
      }
    }
    await replace_all(merged);
  }
  await refresh();
}

function bind_events() {
  els.search_input.addEventListener('input', render);
  els.scope_filter.addEventListener('change', render);
  els.edit_scope.addEventListener('change', sync_pattern_state);
  els.dialog.addEventListener('close', () => void handle_dialog_close());

  els.export_btn.addEventListener('click', () => void export_json());
  els.import_btn.addEventListener('click', () => els.import_file.click());
  els.import_file.addEventListener('change', () => {
    const file = els.import_file.files?.[0];
    if (file) void import_json(file);
    els.import_file.value = '';
  });

  els.tbody.addEventListener('click', (event) => {
    const target = event.target;
    const tr = target.closest('tr');
    if (!tr) return;
    const snippet = snippets.find((s) => s.id === tr.dataset.id);
    if (!snippet) return;
    if (target.closest('.act-delete')) {
      if (window.confirm(`删除「${snippet.title}」？`)) {
        void delete_snippet(snippet.id).then(refresh);
      }
    } else if (target.closest('.act-edit')) {
      open_dialog(snippet);
    }
  });
}

bind_events();
void refresh();
