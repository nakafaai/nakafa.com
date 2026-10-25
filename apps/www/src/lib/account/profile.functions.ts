import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { ProfileInput, ProfilePageInput } from "@/lib/account/input";

/** A profile: the profile and whether the visitor owns it. */
export const answerProfileScreen = async ({
  data,
}: {
  readonly data: typeof ProfileInput.Type;
}) => {
  const { profileScreenHandler } = await import("@/lib/account/profile.server");
  return profileScreenHandler({ data });
};

/** The Posts tab: the first page of posts and the tab's head. */
export const answerProfilePosts = async ({
  data,
}: {
  readonly data: typeof ProfileInput.Type;
}) => {
  const { profilePostsHandler } = await import("@/lib/account/profile.server");
  return profilePostsHandler({ data });
};

/** The Chat tab: the owner's chats and the tab's head. */
export const answerProfileChat = async ({
  data,
}: {
  readonly data: typeof ProfileInput.Type;
}) => {
  const { profileChatHandler } = await import("@/lib/account/profile.server");
  return profileChatHandler({ data });
};

/** The Comments tab: the first page of comments and the tab's head. */
export const answerProfileComments = async ({
  data,
}: {
  readonly data: typeof ProfileInput.Type;
}) => {
  const { profileCommentsHandler } = await import(
    "@/lib/account/profile.server"
  );
  return profileCommentsHandler({ data });
};

/** One more page of a profile's posts, for a visitor who loads more below the rows. */
export const answerProfilePostsPage = async ({
  data,
}: {
  readonly data: typeof ProfilePageInput.Type;
}) => {
  const { profilePostsPageHandler } = await import(
    "@/lib/account/profile.server"
  );
  return profilePostsPageHandler({ data });
};

/** One more page of a profile's comments, for a visitor who loads more below the rows. */
export const answerProfileCommentsPage = async ({
  data,
}: {
  readonly data: typeof ProfilePageInput.Type;
}) => {
  const { profileCommentsPageHandler } = await import(
    "@/lib/account/profile.server"
  );
  return profileCommentsPageHandler({ data });
};

/** A profile: the profile and whether the visitor owns it. */
export const profileScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfileInput))
  .handler(answerProfileScreen);

/** The Posts tab: the first page of posts and the tab's head. */
export const profilePostsFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfileInput))
  .handler(answerProfilePosts);

/** The Chat tab: the owner's chats and the tab's head. */
export const profileChatScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfileInput))
  .handler(answerProfileChat);

/** The Comments tab: the first page of comments and the tab's head. */
export const profileCommentsScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfileInput))
  .handler(answerProfileComments);

/** One more page of a profile's posts, for a visitor who loads more below the rows. */
export const profilePostsPageFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfilePageInput))
  .handler(answerProfilePostsPage);

/** One more page of a profile's comments, for a visitor who loads more below the rows. */
export const profileCommentsPageFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfilePageInput))
  .handler(answerProfileCommentsPage);
