/**
 * Generate a random API key
 * @returns The generated API key
 */
export function generateApiKey(): string {
  return crypto.randomUUID();
}

/**
 * Clean a slug, remove slash at the beginning and the end
 * @param slug - The slug to clean, example: "/hello/world" -> "hello/world"
 * @returns The cleaned slug
 */
export function cleanSlug(slug: string): string {
  return slug.replace(/^\/+|\/+$/g, "");
}
