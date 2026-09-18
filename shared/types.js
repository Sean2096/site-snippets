/**
 * @typedef {'exact' | 'prefix' | 'domain' | 'global'} ScopeType
 *
 * @typedef {object} Snippet
 * @property {string} id
 * @property {string} title
 * @property {string} content
 * @property {ScopeType} scope_type
 * @property {string} pattern Match pattern: full URL for exact/prefix, hostname for domain, '' for global.
 * @property {boolean} pinned
 * @property {number} usage_count
 * @property {number | null} last_used_at
 * @property {number} created_at
 * @property {number} updated_at
 *
 * @typedef {object} NewSnippetInput
 * @property {string} [title]
 * @property {string} content
 * @property {ScopeType} scope_type
 * @property {string} pattern
 *
 * @typedef {object} ParsedPage
 * @property {boolean} ok
 * @property {string} url Full URL without hash.
 * @property {string} host
 */

export {};
