import { defineSchema } from "convex/server";
import chatsSchema from "./chats/schema";
import commentsSchema from "./comments/schema";

export default defineSchema({
  ...chatsSchema,
  ...commentsSchema,
});
