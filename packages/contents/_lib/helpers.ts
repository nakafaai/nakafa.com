/**
 * Clean a slug, remove slash at the beginning and the end
 * @param slug - The slug to clean, example: "/hello/world" -> "hello/world"
 * @returns The cleaned slug
 */
export const cleanSlug = (slug: string): string =>
  slug.replace(/^\/+|\/+$/g, "");
