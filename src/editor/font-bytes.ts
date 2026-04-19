const CORE_URL_MAP: Record<string, () => string> = {
  'Arimo':           () => new URL('../fonts/assets/arimo-regular.woff2',           import.meta.url).href,
  'Tinos':           () => new URL('../fonts/assets/tinos-regular.woff2',           import.meta.url).href,
  'Cousine':         () => new URL('../fonts/assets/cousine-regular.woff2',         import.meta.url).href,
  'Carlito':         () => new URL('../fonts/assets/carlito-regular.woff2',         import.meta.url).href,
  'Caladea':         () => new URL('../fonts/assets/caladea-regular.woff2',         import.meta.url).href,
  'Source Sans 3':   () => new URL('../fonts/assets/source-sans-3-regular.woff2',   import.meta.url).href,
  'Source Serif 4':  () => new URL('../fonts/assets/source-serif-4-regular.woff2',  import.meta.url).href,
  'Noto Sans':       () => new URL('../fonts/assets/noto-sans-regular.woff2',       import.meta.url).href
};

export async function loadFontBytes(family: string): Promise<ArrayBuffer> {
  const url = CORE_URL_MAP[family];
  if (url) {
    const res = await fetch(url());
    if (!res.ok) throw new Error(`Failed to fetch bundled font ${family}`);
    return await res.arrayBuffer();
  }
  const famParam = family.replace(/\s+/g, '+');
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${famParam}:wght@400&display=swap`)).text();
  const m = css.match(/url\((https:[^)]+\.woff2)\)/);
  if (!m) throw new Error(`No woff2 URL in Google Fonts CSS for ${family}`);
  return await (await fetch(m[1])).arrayBuffer();
}
