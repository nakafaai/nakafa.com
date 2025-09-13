/**
 * Clean a slug, remove slash at the beginning and the end
 * @param slug - The slug to clean, example: "/hello/world" -> "hello/world"
 * @returns The cleaned slug
 */
export function cleanSlug(slug: string): string {
  return slug.replace(/^\/+|\/+$/g, "");
}
