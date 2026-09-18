const STORAGE_KEY = 'snippets_v1';

function now_ts() {
  return Date.now();
}

function derive_title(content) {
  const flat = content.replace(/\s+/g, ' ').trim();
  return flat.length > 20 ? `${flat.slice(0, 20)}…` : flat;
}

export async function get_all_snippets() {
  const record = await chrome.storage.local.get(STORAGE_KEY);
  const value = record[STORAGE_KEY];
  return Array.isArray(value) ? value : [];
}

async function write_all(snippets) {
  await chrome.storage.local.set({ [STORAGE_KEY]: snippets });
}

/** Insert a snippet. Returns null when an identical content+scope binding already exists. */
export async function add_snippet(input) {
  const snippets = await get_all_snippets();
  const scope_type = input.scope_type;
  const pattern = scope_type === 'global' ? '' : input.pattern.trim();

  const duplicate = snippets.some(
    (s) => s.content === input.content && s.scope_type === scope_type && s.pattern === pattern,
  );
  if (duplicate) return null;

  const ts = now_ts();
  const snippet = {
    id: crypto.randomUUID(),
    title: input.title?.trim() || derive_title(input.content),
    content: input.content,
    scope_type,
    pattern,
    pinned: false,
    usage_count: 0,
    last_used_at: null,
    created_at: ts,
    updated_at: ts,
  };
  await write_all([...snippets, snippet]);
  return snippet;
}

export async function update_snippet(id, patch) {
  const snippets = await get_all_snippets();
  const next = snippets.map((s) => {
    if (s.id !== id) return s;
    const scope_type = patch.scope_type ?? s.scope_type;
    return {
      ...s,
      ...patch,
      scope_type,
      pattern: scope_type === 'global' ? '' : (patch.pattern ?? s.pattern).trim(),
      title:
        patch.title !== undefined
          ? patch.title.trim() || derive_title(patch.content ?? s.content)
          : s.title,
      updated_at: now_ts(),
    };
  });
  await write_all(next);
}

export async function delete_snippet(id) {
  const snippets = await get_all_snippets();
  await write_all(snippets.filter((s) => s.id !== id));
}

export async function record_usage(id) {
  const snippets = await get_all_snippets();
  await write_all(
    snippets.map((s) =>
      s.id === id
        ? { ...s, usage_count: s.usage_count + 1, last_used_at: now_ts() }
        : s,
    ),
  );
}

export async function replace_all(snippets) {
  await write_all(snippets);
}

/** Minimal structural validation for imported JSON. */
export function is_snippet_array(value) {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.id === 'string' &&
        typeof item.content === 'string' &&
        ['exact', 'prefix', 'domain', 'global'].includes(item.scope_type),
    )
  );
}
