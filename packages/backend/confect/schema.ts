import { DatabaseSchema } from "@confect/server";
import { tables as modules_chat_chats_tables_ts } from "@repo/backend/confect/modules/chat/chats.tables";
import { tables as modules_commerce_credits_tables_ts } from "@repo/backend/confect/modules/commerce/credits.tables";
import { tables as modules_commerce_customers_tables_ts } from "@repo/backend/confect/modules/commerce/customers.tables";
import { tables as modules_commerce_subscriptions_tables_ts } from "@repo/backend/confect/modules/commerce/subscriptions.tables";
import { tables as modules_content_articleContents_tables_ts } from "@repo/backend/confect/modules/content/articleContents.tables";
import { tables as modules_content_audioStudies_tables_ts } from "@repo/backend/confect/modules/content/audioStudies.tables";
import { tables as modules_content_authors_tables_ts } from "@repo/backend/confect/modules/content/authors.tables";
import { tables as modules_content_bookmarks_tables_ts } from "@repo/backend/confect/modules/content/bookmarks.tables";
import { tables as modules_content_comments_tables_ts } from "@repo/backend/confect/modules/content/comments.tables";
import { tables as modules_content_contents_tables_ts } from "@repo/backend/confect/modules/content/contents.tables";
import { tables as modules_content_exerciseQuestions_tables_ts } from "@repo/backend/confect/modules/content/exerciseQuestions.tables";
import { tables as modules_content_exerciseSets_tables_ts } from "@repo/backend/confect/modules/content/exerciseSets.tables";
import { tables as modules_content_subjectSections_tables_ts } from "@repo/backend/confect/modules/content/subjectSections.tables";
import { tables as modules_content_subjectTopics_tables_ts } from "@repo/backend/confect/modules/content/subjectTopics.tables";
import { tables as modules_identity_users_tables_ts } from "@repo/backend/confect/modules/identity/users.tables";
import { tables as modules_learning_exercises_tables_ts } from "@repo/backend/confect/modules/learning/exercises.tables";
import { tables as modules_notifications_notifications_tables_ts } from "@repo/backend/confect/modules/notifications/notifications.tables";
import { tables as modules_school_assessments_tables_ts } from "@repo/backend/confect/modules/school/assessments.tables";
import { tables as modules_school_classes_tables_ts } from "@repo/backend/confect/modules/school/classes.tables";
import { tables as modules_school_schools_tables_ts } from "@repo/backend/confect/modules/school/schools.tables";
import { tables as modules_tryout_access_tables_ts } from "@repo/backend/confect/modules/tryout/access.tables";
import { tables as modules_tryout_irt_tables_ts } from "@repo/backend/confect/modules/tryout/irt.tables";
import { tables as modules_tryout_tryouts_tables_ts } from "@repo/backend/confect/modules/tryout/tryouts.tables";

export default DatabaseSchema.make()
  .addTable(modules_identity_users_tables_ts[0])
  .addTable(modules_commerce_customers_tables_ts[0])
  .addTable(modules_commerce_subscriptions_tables_ts[0])
  .addTable(modules_commerce_credits_tables_ts[0])
  .addTable(modules_commerce_credits_tables_ts[1])
  .addTable(modules_content_articleContents_tables_ts[0])
  .addTable(modules_content_articleContents_tables_ts[1])
  .addTable(modules_content_authors_tables_ts[0])
  .addTable(modules_content_authors_tables_ts[1])
  .addTable(modules_content_bookmarks_tables_ts[0])
  .addTable(modules_content_bookmarks_tables_ts[1])
  .addTable(modules_content_comments_tables_ts[0])
  .addTable(modules_content_comments_tables_ts[1])
  .addTable(modules_content_contents_tables_ts[0])
  .addTable(modules_content_contents_tables_ts[1])
  .addTable(modules_content_contents_tables_ts[2])
  .addTable(modules_content_contents_tables_ts[3])
  .addTable(modules_content_contents_tables_ts[4])
  .addTable(modules_content_contents_tables_ts[5])
  .addTable(modules_content_contents_tables_ts[6])
  .addTable(modules_content_contents_tables_ts[7])
  .addTable(modules_content_subjectTopics_tables_ts[0])
  .addTable(modules_content_subjectSections_tables_ts[0])
  .addTable(modules_content_exerciseSets_tables_ts[0])
  .addTable(modules_content_exerciseQuestions_tables_ts[0])
  .addTable(modules_content_exerciseQuestions_tables_ts[1])
  .addTable(modules_content_audioStudies_tables_ts[0])
  .addTable(modules_content_audioStudies_tables_ts[1])
  .addTable(modules_learning_exercises_tables_ts[0])
  .addTable(modules_learning_exercises_tables_ts[1])
  .addTable(modules_school_assessments_tables_ts[0])
  .addTable(modules_school_assessments_tables_ts[1])
  .addTable(modules_school_assessments_tables_ts[2])
  .addTable(modules_school_assessments_tables_ts[3])
  .addTable(modules_school_assessments_tables_ts[4])
  .addTable(modules_school_assessments_tables_ts[5])
  .addTable(modules_school_assessments_tables_ts[6])
  .addTable(modules_school_assessments_tables_ts[7])
  .addTable(modules_school_assessments_tables_ts[8])
  .addTable(modules_school_assessments_tables_ts[9])
  .addTable(modules_school_assessments_tables_ts[10])
  .addTable(modules_school_assessments_tables_ts[11])
  .addTable(modules_school_assessments_tables_ts[12])
  .addTable(modules_school_assessments_tables_ts[13])
  .addTable(modules_school_assessments_tables_ts[14])
  .addTable(modules_school_assessments_tables_ts[15])
  .addTable(modules_school_assessments_tables_ts[16])
  .addTable(modules_school_assessments_tables_ts[17])
  .addTable(modules_school_assessments_tables_ts[18])
  .addTable(modules_school_assessments_tables_ts[19])
  .addTable(modules_school_assessments_tables_ts[20])
  .addTable(modules_school_assessments_tables_ts[21])
  .addTable(modules_school_assessments_tables_ts[22])
  .addTable(modules_school_assessments_tables_ts[23])
  .addTable(modules_school_assessments_tables_ts[24])
  .addTable(modules_school_assessments_tables_ts[25])
  .addTable(modules_school_assessments_tables_ts[26])
  .addTable(modules_school_assessments_tables_ts[27])
  .addTable(modules_school_schools_tables_ts[0])
  .addTable(modules_school_schools_tables_ts[1])
  .addTable(modules_school_schools_tables_ts[2])
  .addTable(modules_school_schools_tables_ts[3])
  .addTable(modules_school_classes_tables_ts[0])
  .addTable(modules_school_classes_tables_ts[1])
  .addTable(modules_school_classes_tables_ts[2])
  .addTable(modules_school_classes_tables_ts[3])
  .addTable(modules_school_classes_tables_ts[4])
  .addTable(modules_school_classes_tables_ts[5])
  .addTable(modules_school_classes_tables_ts[6])
  .addTable(modules_school_classes_tables_ts[7])
  .addTable(modules_school_classes_tables_ts[8])
  .addTable(modules_school_classes_tables_ts[9])
  .addTable(modules_school_classes_tables_ts[10])
  .addTable(modules_school_classes_tables_ts[11])
  .addTable(modules_school_classes_tables_ts[12])
  .addTable(modules_school_classes_tables_ts[13])
  .addTable(modules_chat_chats_tables_ts[0])
  .addTable(modules_chat_chats_tables_ts[1])
  .addTable(modules_chat_chats_tables_ts[2])
  .addTable(modules_notifications_notifications_tables_ts[0])
  .addTable(modules_notifications_notifications_tables_ts[1])
  .addTable(modules_notifications_notifications_tables_ts[2])
  .addTable(modules_notifications_notifications_tables_ts[3])
  .addTable(modules_tryout_irt_tables_ts[0])
  .addTable(modules_tryout_irt_tables_ts[1])
  .addTable(modules_tryout_irt_tables_ts[2])
  .addTable(modules_tryout_irt_tables_ts[3])
  .addTable(modules_tryout_irt_tables_ts[4])
  .addTable(modules_tryout_irt_tables_ts[5])
  .addTable(modules_tryout_irt_tables_ts[6])
  .addTable(modules_tryout_irt_tables_ts[7])
  .addTable(modules_tryout_irt_tables_ts[8])
  .addTable(modules_tryout_irt_tables_ts[9])
  .addTable(modules_tryout_access_tables_ts[0])
  .addTable(modules_tryout_access_tables_ts[1])
  .addTable(modules_tryout_access_tables_ts[2])
  .addTable(modules_tryout_access_tables_ts[3])
  .addTable(modules_tryout_access_tables_ts[4])
  .addTable(modules_tryout_tryouts_tables_ts[0])
  .addTable(modules_tryout_tryouts_tables_ts[1])
  .addTable(modules_tryout_tryouts_tables_ts[2])
  .addTable(modules_tryout_tryouts_tables_ts[3])
  .addTable(modules_tryout_tryouts_tables_ts[4])
  .addTable(modules_tryout_tryouts_tables_ts[5])
  .addTable(modules_tryout_tryouts_tables_ts[6]);
