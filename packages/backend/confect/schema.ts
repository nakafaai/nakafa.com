import { DatabaseSchema } from "@confect/server";
import {
  Chats,
  Messages,
  Parts,
} from "@repo/backend/confect/modules/chat/chats.tables";
import {
  CreditResetPeriods,
  CreditTransactions,
} from "@repo/backend/confect/modules/commerce/credits.tables";
import { Customers } from "@repo/backend/confect/modules/commerce/customers.tables";
import { Subscriptions } from "@repo/backend/confect/modules/commerce/subscriptions.tables";
import {
  ArticleContents,
  ArticleReferences,
} from "@repo/backend/confect/modules/content/articleContents.tables";
import {
  AudioGenerationQueue,
  ContentAudios,
} from "@repo/backend/confect/modules/content/audioStudies.tables";
import {
  Authors,
  ContentAuthors,
} from "@repo/backend/confect/modules/content/authors.tables";
import {
  BookmarkCollections,
  Bookmarks,
} from "@repo/backend/confect/modules/content/bookmarks.tables";
import {
  Comments,
  CommentVotes,
} from "@repo/backend/confect/modules/content/comments.tables";
import {
  ArticlePopularity,
  ContentAnalyticsPartitions,
  ContentSearch,
  ContentViewAnalyticsQueue,
  ContentViews,
  ExercisePopularity,
  SubjectPopularity,
  SubjectTrendingBuckets,
} from "@repo/backend/confect/modules/content/contents.tables";
import {
  ExerciseChoices,
  ExerciseQuestions,
} from "@repo/backend/confect/modules/content/exerciseQuestions.tables";
import { ExerciseSets } from "@repo/backend/confect/modules/content/exerciseSets.tables";
import { SubjectSections } from "@repo/backend/confect/modules/content/subjectSections.tables";
import { SubjectTopics } from "@repo/backend/confect/modules/content/subjectTopics.tables";
import { Users } from "@repo/backend/confect/modules/identity/users.tables";
import {
  ExerciseAnswers,
  ExerciseAttempts,
} from "@repo/backend/confect/modules/learning/exercises.tables";
import {
  NotificationCounts,
  NotificationEntityMutes,
  NotificationPreferences,
  Notifications,
} from "@repo/backend/confect/modules/notifications/notifications.tables";
import {
  SchoolAssessmentChoices,
  SchoolAssessmentQuestionBankEntries,
  SchoolAssessmentQuestionBanks,
  SchoolAssessmentQuestions,
  SchoolAssessmentRubricCriteria,
  SchoolAssessmentSections,
  SchoolAssessments,
  SchoolAssessmentVersionChoices,
  SchoolAssessmentVersionQuestions,
  SchoolAssessmentVersionRubricCriteria,
  SchoolAssessmentVersionSections,
  SchoolAssessmentVersions,
} from "@repo/backend/confect/modules/school/assessmentsTables/authoring";
import {
  SchoolAssessmentAssignments,
  SchoolAssessmentAssignmentTargets,
  SchoolAssessmentAttemptEvents,
  SchoolAssessmentAttemptSessions,
  SchoolAssessmentAttempts,
  SchoolAssessmentClassStats,
  SchoolAssessmentEssayGrades,
  SchoolAssessmentFinalGrades,
  SchoolAssessmentFlags,
  SchoolAssessmentLeaderboardEntries,
  SchoolAssessmentQuestionStats,
  SchoolAssessmentResponses,
  SchoolAssessmentSectionAttempts,
  SchoolAssessmentStudentStats,
} from "@repo/backend/confect/modules/school/assessmentsTables/delivery";
import {
  SchoolAssessmentImportDrafts,
  SchoolAssessmentImportJobs,
} from "@repo/backend/confect/modules/school/assessmentsTables/imports";
import {
  SchoolClasses,
  SchoolClassForumPendingUploads,
  SchoolClassForumPostAttachments,
  SchoolClassForumPostReactions,
  SchoolClassForumPosts,
  SchoolClassForumReactions,
  SchoolClassForumReadStates,
  SchoolClassForums,
  SchoolClassInviteCodes,
  SchoolClassMaterialAttachments,
  SchoolClassMaterialGroups,
  SchoolClassMaterials,
  SchoolClassMaterialViews,
  SchoolClassMembers,
} from "@repo/backend/confect/modules/school/classes.tables";
import {
  SchoolActivityLogs,
  SchoolInviteCodes,
  SchoolMembers,
  Schools,
} from "@repo/backend/confect/modules/school/schools.tables";
import {
  TryoutAccessCampaignProducts,
  TryoutAccessCampaigns,
  TryoutAccessGrants,
  TryoutAccessLinks,
  UserTryoutEntitlements,
} from "@repo/backend/confect/modules/tryout/access.tables";
import {
  ExerciseItemParameters,
  IrtCalibrationAttempts,
  IrtCalibrationCacheStats,
  IrtCalibrationQueue,
  IrtCalibrationRuns,
  IrtScalePublicationQueue,
  IrtScaleQualityChecks,
  IrtScaleQualityRefreshQueue,
  IrtScaleVersionItems,
  IrtScaleVersions,
} from "@repo/backend/confect/modules/tryout/irt.tables";
import {
  TryoutAttempts,
  TryoutCatalogMeta,
  TryoutLeaderboardEntries,
  TryoutPartAttempts,
  TryoutPartSets,
  Tryouts,
  UserTryoutStats,
} from "@repo/backend/confect/modules/tryout/tryouts.tables";

export default DatabaseSchema.make()
  .addTable(Users)
  .addTable(Customers)
  .addTable(Subscriptions)
  .addTable(CreditTransactions)
  .addTable(CreditResetPeriods)
  .addTable(ArticleContents)
  .addTable(ArticleReferences)
  .addTable(Authors)
  .addTable(ContentAuthors)
  .addTable(Bookmarks)
  .addTable(BookmarkCollections)
  .addTable(Comments)
  .addTable(CommentVotes)
  .addTable(ContentViews)
  .addTable(ContentViewAnalyticsQueue)
  .addTable(ContentAnalyticsPartitions)
  .addTable(ArticlePopularity)
  .addTable(SubjectPopularity)
  .addTable(SubjectTrendingBuckets)
  .addTable(ExercisePopularity)
  .addTable(ContentSearch)
  .addTable(SubjectTopics)
  .addTable(SubjectSections)
  .addTable(ExerciseSets)
  .addTable(ExerciseQuestions)
  .addTable(ExerciseChoices)
  .addTable(ContentAudios)
  .addTable(AudioGenerationQueue)
  .addTable(ExerciseAttempts)
  .addTable(ExerciseAnswers)
  .addTable(SchoolAssessments)
  .addTable(SchoolAssessmentVersions)
  .addTable(SchoolAssessmentSections)
  .addTable(SchoolAssessmentVersionSections)
  .addTable(SchoolAssessmentQuestions)
  .addTable(SchoolAssessmentVersionQuestions)
  .addTable(SchoolAssessmentChoices)
  .addTable(SchoolAssessmentVersionChoices)
  .addTable(SchoolAssessmentRubricCriteria)
  .addTable(SchoolAssessmentVersionRubricCriteria)
  .addTable(SchoolAssessmentQuestionBanks)
  .addTable(SchoolAssessmentQuestionBankEntries)
  .addTable(SchoolAssessmentAssignments)
  .addTable(SchoolAssessmentAssignmentTargets)
  .addTable(SchoolAssessmentAttempts)
  .addTable(SchoolAssessmentSectionAttempts)
  .addTable(SchoolAssessmentResponses)
  .addTable(SchoolAssessmentEssayGrades)
  .addTable(SchoolAssessmentFinalGrades)
  .addTable(SchoolAssessmentAttemptSessions)
  .addTable(SchoolAssessmentAttemptEvents)
  .addTable(SchoolAssessmentFlags)
  .addTable(SchoolAssessmentStudentStats)
  .addTable(SchoolAssessmentQuestionStats)
  .addTable(SchoolAssessmentClassStats)
  .addTable(SchoolAssessmentLeaderboardEntries)
  .addTable(SchoolAssessmentImportJobs)
  .addTable(SchoolAssessmentImportDrafts)
  .addTable(Schools)
  .addTable(SchoolMembers)
  .addTable(SchoolInviteCodes)
  .addTable(SchoolActivityLogs)
  .addTable(SchoolClasses)
  .addTable(SchoolClassMembers)
  .addTable(SchoolClassInviteCodes)
  .addTable(SchoolClassForums)
  .addTable(SchoolClassForumReactions)
  .addTable(SchoolClassForumPosts)
  .addTable(SchoolClassForumPendingUploads)
  .addTable(SchoolClassForumPostAttachments)
  .addTable(SchoolClassForumPostReactions)
  .addTable(SchoolClassForumReadStates)
  .addTable(SchoolClassMaterialGroups)
  .addTable(SchoolClassMaterials)
  .addTable(SchoolClassMaterialAttachments)
  .addTable(SchoolClassMaterialViews)
  .addTable(Chats)
  .addTable(Messages)
  .addTable(Parts)
  .addTable(Notifications)
  .addTable(NotificationCounts)
  .addTable(NotificationPreferences)
  .addTable(NotificationEntityMutes)
  .addTable(IrtCalibrationQueue)
  .addTable(IrtCalibrationAttempts)
  .addTable(IrtCalibrationCacheStats)
  .addTable(IrtScaleQualityChecks)
  .addTable(IrtScaleQualityRefreshQueue)
  .addTable(IrtScalePublicationQueue)
  .addTable(IrtScaleVersions)
  .addTable(IrtScaleVersionItems)
  .addTable(IrtCalibrationRuns)
  .addTable(ExerciseItemParameters)
  .addTable(TryoutAccessCampaigns)
  .addTable(TryoutAccessCampaignProducts)
  .addTable(TryoutAccessLinks)
  .addTable(TryoutAccessGrants)
  .addTable(UserTryoutEntitlements)
  .addTable(Tryouts)
  .addTable(TryoutCatalogMeta)
  .addTable(TryoutPartSets)
  .addTable(TryoutAttempts)
  .addTable(TryoutPartAttempts)
  .addTable(UserTryoutStats)
  .addTable(TryoutLeaderboardEntries);
