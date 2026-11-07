/**
 * The icons a button with no words goes by, the words in its tooltip and
 * aria-label: the files list's, and the top bar's copies beside them.
 * Drawn with the text's own colour; the trash's is set red in the stylesheet.
 */

export const ICONS = {
  branch: '<circle cx="4.5" cy="3.5" r="1.5"/><circle cx="4.5" cy="12.5" r="1.5"/><circle cx="11.5" cy="4.5" r="1.5"/><path d="M4.5 5v6M11.5 6c0 3.5-7 2.5-7 5"/>',
  export: '<path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10"/>',
  trash: '<path d="M2.5 4.5h11M6 4.5V2.8h4v1.7M4 4.5l.8 9h6.4l.8-9M6.8 7v4.5M9.2 7v4.5"/>',
  extract: '<path d="M9.5 2.5h4v4M13.5 2.5 8 8M11.5 9.5v3.2a.8.8 0 0 1-.8.8H3.3a.8.8 0 0 1-.8-.8V5.3a.8.8 0 0 1 .8-.8h3.2"/>',
  'new-file': '<path d="M9.5 2H4.3a.8.8 0 0 0-.8.8v10.4a.8.8 0 0 0 .8.8h7.4a.8.8 0 0 0 .8-.8V5zM9.5 2v3h3M8 7.5v4M6 9.5h4"/>',
  'start-today': '<rect x="2.5" y="3.5" width="11" height="10" rx="1.3"/><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3M8 8.2v3.6M6.2 10h3.6"/>',
  'open-today': '<rect x="2.5" y="3.5" width="11" height="10" rx="1.3"/><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3M5.8 10l1.6 1.6 2.9-3.1"/>',
  close: '<path d="M4 4l8 8M12 4l-8 8"/>',
  promote: '<path d="M8 2.2l1.8 3.7 4 .6-2.9 2.8.7 4L8 11.4l-3.6 1.9.7-4L2.2 6.5l4-.6z"/>',
  // A page with another behind it, both dog-eared as New's is.
  'copy-file': '<path d="M8 5.5H3.3a.8.8 0 0 0-.8.8v7a.8.8 0 0 0 .8.8h6.4a.8.8 0 0 0 .8-.8V8zM8 5.5V8h2.5M5.5 5.5V2.8a.8.8 0 0 1 .8-.8H11l2.5 2.5v6.2a.8.8 0 0 1-.8.8h-2.2M11 2v2.5h2.5"/>',
  // Start today's calendar, with another sheet behind it.
  'copy-today': '<rect x="2.5" y="5.5" width="8" height="8.5" rx="1.2"/><path d="M2.5 8.5h8M4.8 4.5v2M8.2 4.5v2M6.5 4.5V2.8a.8.8 0 0 1 .8-.8h5.4a.8.8 0 0 1 .8.8v7.4a.8.8 0 0 1-.8.8h-2.2"/>',
};

export const icon = (name) => `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
