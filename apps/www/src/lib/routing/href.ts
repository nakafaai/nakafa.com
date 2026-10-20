/**
 * Make sure href is include "/" in the beginning of the path.
 */
export function getCleanHref(url: string): string {
  return url.startsWith("/") ? url : `/${url}`;
}
