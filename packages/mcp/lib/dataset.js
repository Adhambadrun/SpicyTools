// lib/dataset.js — read-only access to the JSON knowledge that ships with the repo.
//
// Two sources:
//   * packages/toolkit/data/*.json  — the travel-hacking dataset (sweet spots,
//     transfer partners, point valuations, award holds, stopovers, status
//     matches, round-the-world awards, alliances).
//   * packages/mcp/data/*.json      — SpicyQuote's own deal feed (a seed file the
//     operator is expected to replace with a real fare feed).
//
// Everything is read from disk once and cached for the lifetime of the process.
// Nothing here writes, and nothing here calls out to the network.

import { readFileSync } from 'node:fs';

const TOOLKIT_DATA = new URL('../../toolkit/data/', import.meta.url);
const OWN_DATA = new URL('../data/', import.meta.url);

const cache = new Map();

/** Load a JSON dataset. `source` is either `toolkit` or `own`. */
export function loadDataset(name, source = 'toolkit') {
  const key = `${source}:${name}`;

  if (cache.has(key)) {
    return cache.get(key);
  }

  const base = source === 'own' ? OWN_DATA : TOOLKIT_DATA;
  const data = JSON.parse(readFileSync(new URL(`${name}.json`, base), 'utf8'));

  cache.set(key, data);

  return data;
}

/** Datasets are `{ _meta, ...entries }` — drop `_meta` and return [key, value] pairs. */
export function entries(data) {
  return Object.entries(data || {}).filter(([key]) => key !== '_meta');
}

export function metaOf(data) {
  return data?._meta || {};
}

const norm = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** True when `needle` appears in the key or anywhere in the (stringified) value. */
export function matches(key, value, needle) {
  if (!needle) return true;

  const query = norm(needle);

  if (!query) return true;

  if (norm(key).includes(query)) return true;

  const haystack = [
    value?.display_name,
    value?.program,
    value?.name,
    value?.airline,
    value?.title,
    value?.label,
    value?.description,
    value?.notes,
  ]
    .filter(Boolean)
    .map(norm)
    .join(' ');

  if (haystack.includes(query)) return true;

  // Last resort: scan the whole record, capped so huge datasets stay cheap.
  return norm(JSON.stringify(value)).slice(0, 20000).includes(query);
}

/** Filter a dataset down to the entries matching `needle`, capped at `limit`. */
export function queryDataset(data, { needle, limit = 10 } = {}) {
  const hits = entries(data)
    .filter(([key, value]) => matches(key, value, needle))
    .slice(0, Math.max(1, Math.min(Number(limit) || 10, 50)));

  return Object.fromEntries(hits);
}
