import { defineSchema } from "convex/server";
import chatsSchema from "./chats/schema";

export default defineSchema({
  ...chatsSchema,
});
