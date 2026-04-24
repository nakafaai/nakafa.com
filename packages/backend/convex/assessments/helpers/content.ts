import { ConvexError } from "convex/values";

/**
 * Enforce the persisted rich content contract.
 *
 * Rich text is stored as serialized editor payload plus derived plain text so
 * the editor schema never becomes the backend domain model.
 */
export function requireRichContentSize(
  content: { json: string; text: string },
  fieldName: string
) {
  if (content.json.length === 0) {
    throw new ConvexError({
      code: "INVALID_RICH_CONTENT",
      message: `${fieldName} JSON content is required.`,
    });
  }

  if (content.text.length > 20_000) {
    throw new ConvexError({
      code: "INVALID_RICH_CONTENT",
      message: `${fieldName} text content is too large.`,
    });
  }
}
