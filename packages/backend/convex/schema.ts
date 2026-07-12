import articleContentsSchema from "@repo/backend/convex/articleContents/schema";
import assessmentsSchema from "@repo/backend/convex/assessments/schema";
import audioStudiesSchema from "@repo/backend/convex/audioStudies/schema";
import authorsSchema from "@repo/backend/convex/authors/schema";
import bookmarksSchema from "@repo/backend/convex/bookmarks/schema";
import chatsSchema from "@repo/backend/convex/chats/schema";
import classesSchema from "@repo/backend/convex/classes/schema";
import commentsSchema from "@repo/backend/convex/comments/schema";
import contentSyncSchema from "@repo/backend/convex/contentSync/schema";
import contentsSchema from "@repo/backend/convex/contents/schema";
import creditsSchema from "@repo/backend/convex/credits/schema";
import curriculumLessonsSchema from "@repo/backend/convex/curriculumLessons/schema";
import curriculumTopicsSchema from "@repo/backend/convex/curriculumTopics/schema";
import customersSchema from "@repo/backend/convex/customers/schema";
import irtSchema from "@repo/backend/convex/irt/schema";
import learningPreferencesSchema from "@repo/backend/convex/learningPreferences/schema";
import learningProgramsSchema from "@repo/backend/convex/learningPrograms/schema";
import notificationsSchema from "@repo/backend/convex/notifications/schema";
import questionBankSchema from "@repo/backend/convex/questionBank/schema";
import quranSchema from "@repo/backend/convex/quran/schema";
import schoolsSchema from "@repo/backend/convex/schools/schema";
import subscriptionsSchema from "@repo/backend/convex/subscriptions/schema";
import tryoutAccessSchema from "@repo/backend/convex/tryoutAccess/schema";
import tryoutsSchema from "@repo/backend/convex/tryouts/schema";
import usersSchema from "@repo/backend/convex/users/schema";
import { defineSchema } from "convex/server";

export default defineSchema(
  {
    ...usersSchema,
    ...chatsSchema,
    ...commentsSchema,
    ...contentSyncSchema,
    ...customersSchema,
    ...subscriptionsSchema,
    ...schoolsSchema,
    ...assessmentsSchema,
    ...classesSchema,
    ...notificationsSchema,
    ...bookmarksSchema,
    ...contentsSchema,
    ...quranSchema,
    ...authorsSchema,
    ...articleContentsSchema,
    ...curriculumTopicsSchema,
    ...curriculumLessonsSchema,
    ...questionBankSchema,
    ...audioStudiesSchema,
    ...creditsSchema,
    ...irtSchema,
    ...learningPreferencesSchema,
    ...learningProgramsSchema,
    ...tryoutAccessSchema,
    ...tryoutsSchema,
  },
  {
    schemaValidation: true,
  }
);
