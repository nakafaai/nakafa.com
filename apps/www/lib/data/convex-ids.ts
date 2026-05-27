import { GenericId } from "@confect/core";
import { Schema } from "effect";

/** Decodes a chat identifier into the generated Convex chat ID type. */
export const decodeChatId = Schema.decodeUnknownEither(
  GenericId.GenericId("chats")
);

/** Decodes a school forum identifier into the generated Convex forum ID type. */
export const decodeSchoolClassForumId = Schema.decodeUnknownEither(
  GenericId.GenericId("schoolClassForums")
);

/** Decodes a school forum post identifier into the generated Convex post ID type. */
export const decodeSchoolClassForumPostId = Schema.decodeUnknownEither(
  GenericId.GenericId("schoolClassForumPosts")
);

/** Decodes a user identifier into the generated Convex user ID type. */
export const decodeUserId = Schema.decodeUnknownEither(
  GenericId.GenericId("users")
);

/** Decodes a tryout attempt identifier into the generated Convex attempt ID type. */
export const decodeTryoutAttemptId = Schema.decodeUnknownSync(
  GenericId.GenericId("tryoutAttempts")
);
