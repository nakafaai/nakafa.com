import type { Doc } from "@repo/backend/confect/_generated/dataModel";

/** Forum attachment shape returned to the app with a resolved URL. */
export type PostAttachment = Pick<
  Doc<"schoolClassForumPostAttachments">,
  "_id" | "mimeType" | "name" | "size"
> & {
  readonly url: string | null;
};
