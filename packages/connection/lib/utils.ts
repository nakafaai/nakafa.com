export function cleanSlug(slug: string): string {
  // remove slash at the beginning and the end
  return slug.replace(/^\/+|\/+$/g, "");
}
