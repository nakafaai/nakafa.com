import { defineSchema } from "convex/server";
import chatsSchema from "./chats/schema";
import commentsSchema from "./comments/schema";
import usersSchema from "./users/schema";

export default defineSchema({
  ...usersSchema,
  ...chatsSchema,
  ...commentsSchema,
});
