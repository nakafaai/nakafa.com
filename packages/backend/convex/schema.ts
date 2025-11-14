import { defineSchema } from "convex/server";
import chatsSchema from "./chats/schema";
import classesSchema from "./classes/schema";
import commentsSchema from "./comments/schema";
import customersSchema from "./customers/schema";
import schoolsSchema from "./schools/schema";
import subscriptionsSchema from "./subscriptions/schema";
import usersSchema from "./users/schema";

export default defineSchema(
  {
    ...usersSchema,
    ...chatsSchema,
    ...commentsSchema,
    ...customersSchema,
    ...subscriptionsSchema,
    ...schoolsSchema,
    ...classesSchema,
  },
  {
    schemaValidation: true,
  }
);
