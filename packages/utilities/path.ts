/** Roots one path at `/`, and keeps a path that already starts there. */
export function withLeadingSlash(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}
