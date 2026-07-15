const HTTP_URL_PATTERN = /^https?:\/\//i;
const URL_PREFIX_PATTERN = /(https?:\/\/)?(www\.)?/i;

/** Adds an HTTPS scheme when a user-authored link does not provide one. */
export function formatUrl(link: string) {
  const url = link.trim();
  return HTTP_URL_PATTERN.test(url) ? url : `https://${url}`;
}

/** Removes the optional HTTP scheme and www prefix from a display URL. */
export function cleanupUrl(url: string) {
  return url.replace(URL_PREFIX_PATTERN, "");
}
