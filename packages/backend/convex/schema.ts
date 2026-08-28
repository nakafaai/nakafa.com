import authDeletionSchema from "@repo/backend/convex/auth/deletion/schema";
import bookmarksSchema from "@repo/backend/convex/bookmarks/schema";
import chatsSchema from "@repo/backend/convex/chats/tables/schema";
import classesSchema from "@repo/backend/convex/classes/schema";
import commentsSchema from "@repo/backend/convex/comments/schema";
import consentsSchema from "@repo/backend/convex/consents/schema";
import contentReleaseSchema from "@repo/backend/convex/contentRelease/schema";
import contentsSchema from "@repo/backend/convex/contents/schema";
import creditsSchema from "@repo/backend/convex/credits/schema";
import customersSchema from "@repo/backend/convex/customers/schema";
import irtSchema from "@repo/backend/convex/irt/schema";
import learningPreferencesSchema from "@repo/backend/convex/learningPreferences/schema";
import notificationsSchema from "@repo/backend/convex/notifications/schema";
import schoolsSchema from "@repo/backend/convex/schools/schema";
import subscriptionsSchema from "@repo/backend/convex/subscriptions/schema";
import tryoutAccessSchema from "@repo/backend/convex/tryoutAccess/schema";
import tryoutRuntimeSchema from "@repo/backend/convex/tryouts/runtime/schema";
import usersSchema from "@repo/backend/convex/users/schema";
import { defineSchema } from "convex/server";

export default defineSchema(
  {
    ...usersSchema,
    ...authDeletionSchema,
    ...chatsSchema,
    ...commentsSchema,
    ...consentsSchema,
    ...contentReleaseSchema,
    ...customersSchema,
    ...subscriptionsSchema,
    ...schoolsSchema,
    ...classesSchema,
    ...notificationsSchema,
    ...bookmarksSchema,
    ...contentsSchema,
    ...creditsSchema,
    ...irtSchema,
    ...learningPreferencesSchema,
    ...tryoutAccessSchema,
    ...tryoutRuntimeSchema,
  },
  {
    schemaValidation: true,
  }
);
