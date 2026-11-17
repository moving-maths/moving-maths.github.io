// Small HTML helpers for the layouts.

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Tagged template that drops null/undefined/false and joins arrays.
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    out += (v == null || v === false) ? '' : Array.isArray(v) ? v.join('') : v;
    out += strings[i + 1];
  }
  return out;
}

export function formatDate(d) {
  const date = d instanceof Date ? d : new Date(d + 'T00:00:00Z');
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function isoDate(d) {
  const date = d instanceof Date ? d : new Date(d + 'T00:00:00Z');
  return date.toISOString().slice(0, 10);
}
