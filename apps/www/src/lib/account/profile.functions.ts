import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { ProfileInput, ProfilePageInput } from "@/lib/account/input";

/** A profile: the profile and whether the visitor owns it. */
export const profileScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfileInput))
  .handler(async ({ data }) => {
    const { profileScreenHandler } = await import(
      "@/lib/account/profile.server"
    );
    return profileScreenHandler({ data });
  });

/** The Posts tab: the first page of posts and the tab's head. */
export const profilePostsFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfileInput))
  .handler(async ({ data }) => {
    const { profilePostsHandler } = await import(
      "@/lib/account/profile.server"
    );
    return profilePostsHandler({ data });
  });

/** The Chat tab: the owner's chats and the tab's head. */
export const profileChatScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfileInput))
  .handler(async ({ data }) => {
    const { profileChatHandler } = await import("@/lib/account/profile.server");
    return profileChatHandler({ data });
  });

/** The Comments tab: the first page of comments and the tab's head. */
export const profileCommentsScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfileInput))
  .handler(async ({ data }) => {
    const { profileCommentsHandler } = await import(
      "@/lib/account/profile.server"
    );
    return profileCommentsHandler({ data });
  });

/** One more page of a profile's posts, for a visitor who loads more below the rows. */
export const profilePostsPageFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfilePageInput))
  .handler(async ({ data }) => {
    const { profilePostsPageHandler } = await import(
      "@/lib/account/profile.server"
    );
    return profilePostsPageHandler({ data });
  });

/** One more page of a profile's comments, for a visitor who loads more below the rows. */
export const profileCommentsPageFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfilePageInput))
  .handler(async ({ data }) => {
    const { profileCommentsPageHandler } = await import(
      "@/lib/account/profile.server"
    );
    return profileCommentsPageHandler({ data });
  });
