import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { ProfileInput, ProfilePageInput } from "@/lib/account/input";

/** A profile: the profile and whether the visitor owns it. */
export const profileScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfileInput))
  .handler(async (options) => {
    const { profileScreenHandler } = await import(
      "@/lib/account/profile.server"
    );
    return profileScreenHandler(options);
  });

/** The Posts tab: the first page of posts and the tab's head. */
export const profilePostsFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfileInput))
  .handler(async (options) => {
    const { profilePostsHandler } = await import(
      "@/lib/account/profile.server"
    );
    return profilePostsHandler(options);
  });

/** The Chat tab: the owner's chats and the tab's head. */
export const profileChatScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfileInput))
  .handler(async (options) => {
    const { profileChatHandler } = await import("@/lib/account/profile.server");
    return profileChatHandler(options);
  });

/** The Comments tab: the first page of comments and the tab's head. */
export const profileCommentsScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfileInput))
  .handler(async (options) => {
    const { profileCommentsHandler } = await import(
      "@/lib/account/profile.server"
    );
    return profileCommentsHandler(options);
  });

/** One more page of a profile's posts, for a visitor who loads more below the rows. */
export const profilePostsPageFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfilePageInput))
  .handler(async (options) => {
    const { profilePostsPageHandler } = await import(
      "@/lib/account/profile.server"
    );
    return profilePostsPageHandler(options);
  });

/** One more page of a profile's comments, for a visitor who loads more below the rows. */
export const profileCommentsPageFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfilePageInput))
  .handler(async (options) => {
    const { profileCommentsPageHandler } = await import(
      "@/lib/account/profile.server"
    );
    return profileCommentsPageHandler(options);
  });
