import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { ProfileInput } from "@/lib/account/access.server";
import {
  profileChatHandler,
  profileCommentsHandler,
  profilePostsHandler,
  profileScreenHandler,
} from "@/lib/account/profile.server";

/** A profile: the profile and whether the visitor owns it. */
export const profileScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfileInput))
  .handler(profileScreenHandler);

/** The Posts tab: the first page of posts and the tab's head. */
export const profilePostsFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfileInput))
  .handler(profilePostsHandler);

/** The Chat tab: the owner's chats and the tab's head. */
export const profileChatScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfileInput))
  .handler(profileChatHandler);

/** The Comments tab: the first page of comments and the tab's head. */
export const profileCommentsScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfileInput))
  .handler(profileCommentsHandler);
