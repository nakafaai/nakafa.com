import { defineSchema } from "convex/server";
import bookmarksSchema from "./bookmarks/schema";
import chatsSchema from "./chats/schema";
import classesSchema from "./classes/schema";
import commentsSchema from "./comments/schema";
import contentsSchema from "./contents/schema";
import customersSchema from "./customers/schema";
import exercisesSchema from "./exercises/schema";
import notificationsSchema from "./notifications/schema";
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
    ...notificationsSchema,
    ...bookmarksSchema,
    ...contentsSchema,
    ...exercisesSchema,
  },
  {
    schemaValidation: true,
  }
);
