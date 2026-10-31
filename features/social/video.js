/**
 * A YouTube video on the page, `![Body scan](yt:v/FcWl8WgKP8E)`: a card,
 * the video's thumbnail with the alt text as its caption.
 *
 * In the preview, the thumbnail is a button, "Play Body scan", that swaps
 * in YouTube's player (preview.js), from youtube-nocookie.com. Nothing is
 * asked of YouTube's player until then; the thumbnail is an image from
 * img.youtube.com, as any image on the web is. Playing isn't working the
 * page, so it plays wherever the page is shown: on a slide, in a record.
 *
 * An exported page runs no script to swap a player in with, so there the
 * card is a link to the video, which plays it on YouTube.
 */

import { escapeHtml, escapeAttr } from '../source.js';

/** A video's id, from `yt:v/<id>`'s address: letters, digits, `-` and `_`. */
const ID = /^https:\/\/www\.youtube\.com\/watch\?v=([\w-]+)$/;

/** The card for what `yt:v/<id>` found, or null for a channel. */
export function videoCard(found, alt, env) {
  const id = ID.exec(found.href)?.[1];
  if (!id) return null;
  const words = alt.replace(/\s+/g, ' ').trim();
  const thumb = `<img class="video-thumb" src="https://img.youtube.com/vi/${id}/hqdefault.jpg" alt="">`;
  const caption = words ? `<span class="video-caption">${escapeHtml(words)}</span>` : '';
  if (env.exported) {
    return `<a class="video" href="${escapeAttr(found.href)}"><span class="video-screen">${thumb}</span>${caption}`
      + `<span class="video-site">${words ? ' on YouTube' : 'A video on YouTube'}</span></a>`;
  }
  const title = words || 'video';
  return `<span class="video" data-video="${id}" data-title="${escapeAttr(title)}">`
    + `<button type="button" class="video-screen video-play" aria-label="${escapeAttr(`Play ${title}`)}">${thumb}</button>`
    + `${caption}</span>`;
}
