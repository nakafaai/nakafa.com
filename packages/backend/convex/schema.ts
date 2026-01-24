import articleContentsSchema from "@repo/backend/convex/articleContents/schema";
import authorsSchema from "@repo/backend/convex/authors/schema";
import bookmarksSchema from "@repo/backend/convex/bookmarks/schema";
import chatsSchema from "@repo/backend/convex/chats/schema";
import classesSchema from "@repo/backend/convex/classes/schema";
import commentsSchema from "@repo/backend/convex/comments/schema";
import contentsSchema from "@repo/backend/convex/contents/schema";
import customersSchema from "@repo/backend/convex/customers/schema";
import exerciseQuestionsSchema from "@repo/backend/convex/exerciseQuestions/schema";
import exerciseSetsSchema from "@repo/backend/convex/exerciseSets/schema";
import exercisesSchema from "@repo/backend/convex/exercises/schema";
import notificationsSchema from "@repo/backend/convex/notifications/schema";
import schoolsSchema from "@repo/backend/convex/schools/schema";
import subjectSectionsSchema from "@repo/backend/convex/subjectSections/schema";
import subjectTopicsSchema from "@repo/backend/convex/subjectTopics/schema";
import subscriptionsSchema from "@repo/backend/convex/subscriptions/schema";
import usersSchema from "@repo/backend/convex/users/schema";
import { defineSchema } from "convex/server";

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
    ...authorsSchema,
    ...articleContentsSchema,
    ...subjectTopicsSchema,
    ...subjectSectionsSchema,
    ...exerciseSetsSchema,
    ...exerciseQuestionsSchema,
  },
  {
    schemaValidation: true,
  }
);
