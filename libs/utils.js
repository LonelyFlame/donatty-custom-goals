/**
 *
 * @param {string} ref
 * @returns {string}
 */
export const fmtApiUri = (ref) => {
  const baseUri = "https://api.donatty.com";
  const G = 1;
  const q = 30;

  const n = ref.length;
  const r = n - 2;
  const i = ref.slice(r, n);
  const o = parseInt(i, 16);
  const s = G + o % (q - G);
  const a = new Intl.NumberFormat("en-IN",{ minimumIntegerDigits: 3 }).format(s);

  return baseUri.replace("://api.", `://api-${a}.`);
};
