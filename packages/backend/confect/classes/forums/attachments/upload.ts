import { FORUM_ATTACHMENT_UPLOAD_PATH_PREFIX } from "@repo/backend/confect/classes/forums/attachments/constants";
import { ForumAttachmentUploadConfigError } from "@repo/backend/confect/classes/forums/attachments/spec";
import type { forumAttachmentUploadOutcomeValidator } from "@repo/backend/confect/classes/forums/attachments/upload.spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Config, Effect, type Schema } from "effect";
export type ForumAttachmentUploadOutcome = Schema.Schema.Type<
  typeof forumAttachmentUploadOutcomeValidator
>;
/** Builds one opaque, deployment-owned upload capability URL. */
export const createForumAttachmentUploadUrl = Effect.fn(
  "classes.forums.attachments.createUploadUrl"
)(function* (
  uploadId: Id<"schoolClassForumPendingUploads">,
  uploadToken: string
) {
  const siteUrl = yield* Config.URL("CONVEX_SITE_URL").pipe(
    Effect.mapError(
      () =>
        new ForumAttachmentUploadConfigError({
          code: "FORUM_ATTACHMENT_UPLOAD_CONFIG_INVALID",
          message: "Forum attachment upload is not configured.",
        })
    )
  );
  const url = new URL(
    `${FORUM_ATTACHMENT_UPLOAD_PATH_PREFIX}/${uploadId}/${uploadToken}`,
    siteUrl
  );
  return url.toString();
});
