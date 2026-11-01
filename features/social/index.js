/**
 * Where to find someone: `linkedin:jzheaux[]` links to that profile, with
 * the site's mark beside it.
 *
 *   linkedin:jzheaux[]     linkedin.com/in/jzheaux
 *   bluesky:jzheaux[]      @jzheaux.bsky.social
 *   gh:jzheaux[]           github.com/jzheaux
 *   gh:jzheaux/reader#5[]  jzheaux/reader#5, the issue (or pull request)
 *   gh:jzheaux/reader@f61f000[]  jzheaux/reader@f61f000, the commit
 *   fb:jzheaux[]           facebook.com/jzheaux
 *   insta:jzheaux[]        @jzheaux
 *   yt:jzheaux[]           @jzheaux
 *   yt:v/FcWl8WgKP8E[]     youtu.be/FcWl8WgKP8E, the video
 *
 * It shows as the site would write it, on the right above, unless the
 * brackets say otherwise: `gh:jzheaux[my GitHub]`. A Bluesky handle with a
 * dot in it is a whole one (`bluesky:jzheaux.dev[]`); a LinkedIn name with a
 * slash is another kind of page (`linkedin:company/vmware[]`), and so is a
 * YouTube one: `yt:v/<id>` is a video, since a handle can look like an id.
 *
 * The marks are in icons/, and go into the stylesheet as masks, so each is
 * drawn in its site's color. A mark is only seen, so the link also says
 * where it goes, out of sight: "@jzheaux on Instagram", read aloud, where
 * the page shows the mark and "@jzheaux". A name that already says its site
 * (`github.com/jzheaux`, `[my GitHub]`) needs no more.
 *
 * And `![Body scan](yt:v/FcWl8WgKP8E)` shows the video, a card to play it
 * from (video.js).
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { schemeLinks } from '../scheme.js';
import { videoCard, alone } from './video.js';

const bare = (name) => name.replace(/^@/, '');

// scheme -> the site: its name, its icon in icons/, its color (none: the
// text's own), and the address and the words for a name there.
const SITES = {
  linkedin: {
    site: 'LinkedIn',
    icon: 'linkedin',
    color: 'var(--gm-brand-linkedin)',
    at: (name) => {
      const page = name.includes('/') ? name : `in/${name}`;
      return { href: `https://www.linkedin.com/${page}`, label: `linkedin.com/${page}` };
    },
  },
  bluesky: {
    site: 'Bluesky',
    icon: 'bluesky',
    color: 'var(--gm-brand-bluesky)',
    at: (name) => {
      const handle = name.includes('.') ? name : `${name}.bsky.social`;
      return { href: `https://bsky.app/profile/${handle}`, label: `@${handle}` };
    },
  },
  gh: {
    site: 'GitHub',
    icon: 'github',
    at: (name) => {
      // As GitHub writes its own references: `owner/repo#5`, `owner/repo@sha`.
      const ref = /^([\w.-]+\/[\w.-]+)(?:#(\d+)|@([0-9a-f]{7,40}))$/i.exec(name);
      if (ref?.[2]) return { href: `https://github.com/${ref[1]}/issues/${ref[2]}`, label: `${ref[1]}#${ref[2]}` };
      if (ref?.[3]) return { href: `https://github.com/${ref[1]}/commit/${ref[3]}`, label: `${ref[1]}@${ref[3].slice(0, 7)}` };
      if (/[#@]/.test(name)) return null;
      return { href: `https://github.com/${name}`, label: `github.com/${name}` };
    },
  },
  fb: {
    site: 'Facebook',
    icon: 'facebook',
    color: 'var(--gm-brand-facebook)',
    at: (name) => ({ href: `https://www.facebook.com/${name}`, label: `facebook.com/${name}` }),
  },
  insta: {
    site: 'Instagram',
    icon: 'instagram',
    color: 'var(--gm-brand-instagram)',
    at: (name) => ({ href: `https://www.instagram.com/${name}`, label: `@${name}` }),
  },
  yt: {
    site: 'YouTube',
    icon: 'youtube',
    color: 'var(--gm-brand-youtube)',
    at: (name) => {
      const video = /^v\/([\w-]+)$/.exec(name);
      if (video) return { href: `https://www.youtube.com/watch?v=${video[1]}`, label: `youtu.be/${video[1]}` };
      if (name.includes('/')) return null;
      return { href: `https://www.youtube.com/@${name}`, label: `@${name}` };
    },
  },
};

/**
 * `linkedin`, `jzheaux`, `` -> `{ href, label, site }`, or null without a
 * name. `site` is the site's name, unless the label already says it.
 */
export function socialLink(scheme, path, label) {
  const name = bare(path).replace(/^\/+|\/+$/g, '');
  if (!name || !SITES[scheme]) return null;
  const found = SITES[scheme].at(name);
  if (!found) return null;
  const words = label.trim() || found.label;
  const { site } = SITES[scheme];
  const said = words.toLowerCase().includes(site.toLowerCase());
  return { href: found.href, label: words, ...(said ? {} : { site }) };
}

export function social(md) {
  for (const scheme of Object.keys(SITES)) {
    schemeLinks(md, {
      name: `social_${scheme}`,
      scheme,
      path: /[\w.@/#-]*/,
      link: (path, label) => {
        const found = socialLink(scheme, path, label);
        if (!found) return null;
        const { site, ...link } = found;
        return {
          ...link,
          attrs: [['class', `social social-${scheme}`]],
          after: site && `<span class="social-site vh"> on ${site}</span>`,
        };
      },
      ...(scheme === 'yt' ? { show: videoCard } : {}),
    });
  }
}

/** An icon's file as a CSS `url()`, without its title. */
function mask(icon) {
  const svg = fs.readFileSync(new URL(`./icons/${icon}.svg`, import.meta.url), 'utf8')
    .replace(/<title>.*?<\/title>/, '').replace(/ role="img"/, '').trim();
  return `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/%20/g, ' ').replace(/%2F/g, '/').replace(/%3D/g, '=').replace(/%3A/g, ':')}")`;
}

const CSS = `${fs.readFileSync(new URL('./social.css', import.meta.url), 'utf8')}${fs.readFileSync(new URL('./video.css', import.meta.url), 'utf8')}${
  Object.entries(SITES).map(([scheme, { icon, color }]) =>
    `a.social-${scheme}::before { --mark: ${mask(icon)};${color ? ` background-color: ${color};` : ''} }`).join('\n')}\n`;

export default {
  name: 'social',
  plugin: social,
  // A video alone in its paragraph as wide as the page lets it be.
  html: alone,
  css: CSS,
  // Drawn into the preview frame, to play a video.
  preview: fileURLToPath(new URL('./preview.js', import.meta.url)),
};
