/** Higher = more specific; used for sorting. */
export const SCOPE_PRIORITY = {
  exact: 3,
  prefix: 2,
  domain: 1,
  global: 0,
};

export const SCOPE_LABELS = {
  exact: '精确',
  prefix: '前缀',
  domain: '域名',
  global: '全局',
};

/** Parse a raw page URL into a hash-free normalized page descriptor. */
export function parse_page(raw_url) {
  try {
    const u = new URL(raw_url);
    const url = `${u.origin}${u.pathname}${u.search}`;
    return { ok: true, url, host: u.hostname };
  } catch {
    return { ok: false, url: raw_url, host: '' };
  }
}

/** Whether a snippet is in scope for the given page. */
export function matches(snippet, page) {
  switch (snippet.scope_type) {
    case 'global':
      return true;
    case 'exact':
      return snippet.pattern === page.url;
    case 'prefix':
      return page.url.startsWith(snippet.pattern);
    case 'domain':
      return (
        page.host === snippet.pattern || page.host.endsWith(`.${snippet.pattern}`)
      );
  }
}

/** Default binding for a newly captured snippet: bare hostname (matches subdomains). */
export function default_pattern(page) {
  if (!page.ok || !page.host) return { scope_type: 'global', pattern: '' };
  return { scope_type: 'domain', pattern: page.host };
}

/** Pinned first, then specificity, then most recently used / created. */
export function sort_snippets(list) {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const pa = SCOPE_PRIORITY[a.scope_type];
    const pb = SCOPE_PRIORITY[b.scope_type];
    if (pa !== pb) return pb - pa;
    return (b.last_used_at ?? b.created_at) - (a.last_used_at ?? a.created_at);
  });
}
