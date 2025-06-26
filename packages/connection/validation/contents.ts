import type { Content } from "@repo/contents/_types/content";
import { ContentSchema } from "@repo/contents/_types/content";

/**
 * Validates a Content object against its schema
 * @param url - The url of the content
 * @param content - The content object to validate
 * @returns An empty string if validation succeeds, or an error message if validation fails
 */
export function validateContent(
  url: string,
  content: Content | null
): {
  parsed: Content | null;
  error: string | null;
} {
  const parsedContent = ContentSchema.safeParse(content);
  if (!parsedContent.success) {
    return {
      parsed: null,
      error: `Error validating content for ${url}: ${parsedContent.error.message}`,
    };
  }
  return {
    parsed: {
      ...content,
      ...parsedContent.data,
    },
    error: null,
  };
}

/**
 * Validates an array of Content objects against their schema
 * @param url - The url of the content
 * @param contents - The array of content objects to validate
 * @returns An empty string if validation succeeds, or an error message if validation fails
 */
export function validateContents(
  url: string,
  contents: Content[] | null
): {
  parsed: Content[];
  error: string | null;
} {
  const parsed: Content[] = [];

  if (!contents) {
    return {
      parsed: [],
      error: `Missing contents data from the server for ${url}`,
    };
  }
  for (const content of contents) {
    const { error, parsed: parsedContent } = validateContent(url, content);
    if (error || !parsedContent) {
      continue;
    }
    parsed.push(parsedContent);
  }
  return {
    parsed,
    error: null,
  };
}
