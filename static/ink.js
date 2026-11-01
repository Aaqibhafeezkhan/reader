/**
 * Text goes light on a dark background: `.gm-bg` (src/background.js) is
 * asked what its color came to, so a name and a `#hex` read alike, and the
 * ink is whichever of the page's dark one and its light one stands out more
 * against it, by WCAG's contrast ratio. An image alone says nothing; it's
 * taken for a light one.
 *
 * A page with nothing behind it is drawn as the app's theme is, dark or
 * light (static/theme.js): its background, when it has one, wins over the
 * theme, so a light one stays light paper with dark ink in the dark theme.
 *
 * The preview frame inks each render, told the theme with it
 * (static/preview.js); an exported page has this file inside it, and inks
 * itself as it opens, light but for a dark background (src/export.js).
 */

window.Ink = (() => {
  // --gm-ink, light and dark (src/columns.css; test/contrast.test.js keeps
  // them the same)
  const DARK_INK = [0x1a, 0x1a, 0x1a];
  const LIGHT_INK = [0xf5, 0xf3, 0xee];

  /** WCAG's relative luminance of an sRGB color, `[r, g, b]` from 0 to 255. */
  function luminance(rgb) {
    const [r, g, b] = rgb.slice(0, 3).map((c) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /** WCAG's contrast ratio of two colors, from 1 to 21. */
  function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }

  /** Whether the light ink reads better than the dark on `rgb`, `[r, g, b, a?]`. */
  function lightInk(rgb) {
    return (rgb[3] ?? 1) > 0.5 && contrast(LIGHT_INK, rgb) > contrast(DARK_INK, rgb);
  }

  /** Inks the page by its `.gm-bg`, or, with none, dark when `dark` says so. */
  function set(dark = false) {
    const bg = document.querySelector('.gm-bg');
    const rgb = bg && getComputedStyle(bg).backgroundColor.match(/[\d.]+/g)?.map(Number);
    document.documentElement.classList.toggle('gm-dark', bg ? Boolean(rgb) && lightInk(rgb) : Boolean(dark));
  }

  return { lightInk, set };
})();
