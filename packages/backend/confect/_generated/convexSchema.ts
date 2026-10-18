import { defineSchema as $defineSchema } from "convex/server";
import { Table as $Table } from "@confect/server";

import accountConsentDecisions from "./tables/accountConsentDecisions";
import accountConsents from "./tables/accountConsents";
import accountDeletionAttemptCancellations from "./tables/accountDeletionAttemptCancellations";
import accountDeletionPreparations from "./tables/accountDeletionPreparations";
import accountDeletionReceipts from "./tables/accountDeletionReceipts";
import articleBuckets from "./tables/articleBuckets";
import articleCatalog from "./tables/articleCatalog";
import articleCategories from "./tables/articleCategories";
import chatShares from "./tables/chatShares";
import chats from "./tables/chats";
import classGrades from "./tables/classGrades";
import classTeachers from "./tables/classTeachers";
import classes from "./tables/classes";
import classroomChannels from "./tables/classroomChannels";
import commentLikes from "./tables/commentLikes";
import commentVotes from "./tables/commentVotes";
import comments from "./tables/comments";
import contentAnalyticsPartitions from "./tables/contentAnalyticsPartitions";
import contentArtifactFacts from "./tables/contentArtifactFacts";
import contentArtifacts from "./tables/contentArtifacts";
import contentBindings from "./tables/contentBindings";
import contentCompaction from "./tables/contentCompaction";
import contentHeads from "./tables/contentHeads";
import contentIndex from "./tables/contentIndex";
import contentItems from "./tables/contentItems";
import contentKeys from "./tables/contentKeys";
import contentModelBuilds from "./tables/contentModelBuilds";
import contentPaths from "./tables/contentPaths";
import contentReleases from "./tables/contentReleases";
import contentSectionSources from "./tables/contentSectionSources";
import contentSectionState from "./tables/contentSectionState";
import contentSections from "./tables/contentSections";
import contentSnapshots from "./tables/contentSnapshots";
import contentState from "./tables/contentState";
import creditResetPeriods from "./tables/creditResetPeriods";
import creditTransactions from "./tables/creditTransactions";
import curriculumRoutes from "./tables/curriculumRoutes";
import customerDeletionTombstones from "./tables/customerDeletionTombstones";
import customers from "./tables/customers";
import editorClients from "./tables/editorClients";
import editorDocuments from "./tables/editorDocuments";
import editorSnapshots from "./tables/editorSnapshots";
import editorSteps from "./tables/editorSteps";
import examAnswers from "./tables/examAnswers";
import examAttempts from "./tables/examAttempts";
import examQuestions from "./tables/examQuestions";
import examSignals from "./tables/examSignals";
import examSittings from "./tables/examSittings";
import exams from "./tables/exams";
import gradingSchemes from "./tables/gradingSchemes";
import integrationClients from "./tables/integrationClients";
import irtCalibrationRuns from "./tables/irtCalibrationRuns";
import irtScaleItems from "./tables/irtScaleItems";
import irtScaleVersions from "./tables/irtScaleVersions";
import journalCursors from "./tables/journalCursors";
import journalEntries from "./tables/journalEntries";
import learningEngagementQueue from "./tables/learningEngagementQueue";
import learningPopularityCounters from "./tables/learningPopularityCounters";
import learningPopularityCycles from "./tables/learningPopularityCycles";
import learningPopularitySignals from "./tables/learningPopularitySignals";
import learningPopularityViewerSignals from "./tables/learningPopularityViewerSignals";
import learningPreferences from "./tables/learningPreferences";
import learningViews from "./tables/learningViews";
import loginCards from "./tables/loginCards";
import materialBuckets from "./tables/materialBuckets";
import materialCatalog from "./tables/materialCatalog";
import ninaMemories from "./tables/ninaMemories";
import ninaMemoryKeys from "./tables/ninaMemoryKeys";
import ninaMemoryPortraits from "./tables/ninaMemoryPortraits";
import ninaMemoryRestores from "./tables/ninaMemoryRestores";
import ninaSummaries from "./tables/ninaSummaries";
import ninaTurns from "./tables/ninaTurns";
import ninaUploads from "./tables/ninaUploads";
import notifications from "./tables/notifications";
import onboardingProfiles from "./tables/onboardingProfiles";
import operators from "./tables/operators";
import postLikes from "./tables/postLikes";
import posts from "./tables/posts";
import programBuckets from "./tables/programBuckets";
import programCatalog from "./tables/programCatalog";
import quranRows from "./tables/quranRows";
import quranSearch from "./tables/quranSearch";
import schoolLogins from "./tables/schoolLogins";
import snapshotBatches from "./tables/snapshotBatches";
import subscriptions from "./tables/subscriptions";
import tenantAssignments from "./tables/tenantAssignments";
import tenantCohortMembers from "./tables/tenantCohortMembers";
import tenantCohorts from "./tables/tenantCohorts";
import tenantGraduates from "./tables/tenantGraduates";
import tenantGrants from "./tables/tenantGrants";
import tenantInvites from "./tables/tenantInvites";
import tenantKeys from "./tables/tenantKeys";
import tenantPeople from "./tables/tenantPeople";
import tenantPeriods from "./tables/tenantPeriods";
import tenantPromotionMoves from "./tables/tenantPromotionMoves";
import tenantPromotions from "./tables/tenantPromotions";
import tenantUnits from "./tables/tenantUnits";
import tenantVisits from "./tables/tenantVisits";
import tenants from "./tables/tenants";
import tryoutAttemptPlacements from "./tables/tryoutAttemptPlacements";
import tryoutAttempts from "./tables/tryoutAttempts";
import tryoutCatalog from "./tables/tryoutCatalog";
import tryoutPlacements from "./tables/tryoutPlacements";
import tryoutResponses from "./tables/tryoutResponses";
import tryoutRuntimeBundles from "./tables/tryoutRuntimeBundles";
import tryoutScores from "./tables/tryoutScores";
import tryoutSectionAttempts from "./tables/tryoutSectionAttempts";
import tryoutSetProgress from "./tables/tryoutSetProgress";
import userLearningRecents from "./tables/userLearningRecents";
import users from "./tables/users";
import vaultKeys from "./tables/vaultKeys";
import welcomeEmailIntents from "./tables/welcomeEmailIntents";

export default $defineSchema({
  accountConsentDecisions: $Table.tableDefinition(accountConsentDecisions),
  accountConsents: $Table.tableDefinition(accountConsents),
  accountDeletionAttemptCancellations: $Table.tableDefinition(accountDeletionAttemptCancellations),
  accountDeletionPreparations: $Table.tableDefinition(accountDeletionPreparations),
  accountDeletionReceipts: $Table.tableDefinition(accountDeletionReceipts),
  articleBuckets: $Table.tableDefinition(articleBuckets),
  articleCatalog: $Table.tableDefinition(articleCatalog),
  articleCategories: $Table.tableDefinition(articleCategories),
  chatShares: $Table.tableDefinition(chatShares),
  chats: $Table.tableDefinition(chats),
  classGrades: $Table.tableDefinition(classGrades),
  classTeachers: $Table.tableDefinition(classTeachers),
  classes: $Table.tableDefinition(classes),
  classroomChannels: $Table.tableDefinition(classroomChannels),
  commentLikes: $Table.tableDefinition(commentLikes),
  commentVotes: $Table.tableDefinition(commentVotes),
  comments: $Table.tableDefinition(comments),
  contentAnalyticsPartitions: $Table.tableDefinition(contentAnalyticsPartitions),
  contentArtifactFacts: $Table.tableDefinition(contentArtifactFacts),
  contentArtifacts: $Table.tableDefinition(contentArtifacts),
  contentBindings: $Table.tableDefinition(contentBindings),
  contentCompaction: $Table.tableDefinition(contentCompaction),
  contentHeads: $Table.tableDefinition(contentHeads),
  contentIndex: $Table.tableDefinition(contentIndex),
  contentItems: $Table.tableDefinition(contentItems),
  contentKeys: $Table.tableDefinition(contentKeys),
  contentModelBuilds: $Table.tableDefinition(contentModelBuilds),
  contentPaths: $Table.tableDefinition(contentPaths),
  contentReleases: $Table.tableDefinition(contentReleases),
  contentSectionSources: $Table.tableDefinition(contentSectionSources),
  contentSectionState: $Table.tableDefinition(contentSectionState),
  contentSections: $Table.tableDefinition(contentSections),
  contentSnapshots: $Table.tableDefinition(contentSnapshots),
  contentState: $Table.tableDefinition(contentState),
  creditResetPeriods: $Table.tableDefinition(creditResetPeriods),
  creditTransactions: $Table.tableDefinition(creditTransactions),
  curriculumRoutes: $Table.tableDefinition(curriculumRoutes),
  customerDeletionTombstones: $Table.tableDefinition(customerDeletionTombstones),
  customers: $Table.tableDefinition(customers),
  editorClients: $Table.tableDefinition(editorClients),
  editorDocuments: $Table.tableDefinition(editorDocuments),
  editorSnapshots: $Table.tableDefinition(editorSnapshots),
  editorSteps: $Table.tableDefinition(editorSteps),
  examAnswers: $Table.tableDefinition(examAnswers),
  examAttempts: $Table.tableDefinition(examAttempts),
  examQuestions: $Table.tableDefinition(examQuestions),
  examSignals: $Table.tableDefinition(examSignals),
  examSittings: $Table.tableDefinition(examSittings),
  exams: $Table.tableDefinition(exams),
  gradingSchemes: $Table.tableDefinition(gradingSchemes),
  integrationClients: $Table.tableDefinition(integrationClients),
  irtCalibrationRuns: $Table.tableDefinition(irtCalibrationRuns),
  irtScaleItems: $Table.tableDefinition(irtScaleItems),
  irtScaleVersions: $Table.tableDefinition(irtScaleVersions),
  journalCursors: $Table.tableDefinition(journalCursors),
  journalEntries: $Table.tableDefinition(journalEntries),
  learningEngagementQueue: $Table.tableDefinition(learningEngagementQueue),
  learningPopularityCounters: $Table.tableDefinition(learningPopularityCounters),
  learningPopularityCycles: $Table.tableDefinition(learningPopularityCycles),
  learningPopularitySignals: $Table.tableDefinition(learningPopularitySignals),
  learningPopularityViewerSignals: $Table.tableDefinition(learningPopularityViewerSignals),
  learningPreferences: $Table.tableDefinition(learningPreferences),
  learningViews: $Table.tableDefinition(learningViews),
  loginCards: $Table.tableDefinition(loginCards),
  materialBuckets: $Table.tableDefinition(materialBuckets),
  materialCatalog: $Table.tableDefinition(materialCatalog),
  ninaMemories: $Table.tableDefinition(ninaMemories),
  ninaMemoryKeys: $Table.tableDefinition(ninaMemoryKeys),
  ninaMemoryPortraits: $Table.tableDefinition(ninaMemoryPortraits),
  ninaMemoryRestores: $Table.tableDefinition(ninaMemoryRestores),
  ninaSummaries: $Table.tableDefinition(ninaSummaries),
  ninaTurns: $Table.tableDefinition(ninaTurns),
  ninaUploads: $Table.tableDefinition(ninaUploads),
  notifications: $Table.tableDefinition(notifications),
  onboardingProfiles: $Table.tableDefinition(onboardingProfiles),
  operators: $Table.tableDefinition(operators),
  postLikes: $Table.tableDefinition(postLikes),
  posts: $Table.tableDefinition(posts),
  programBuckets: $Table.tableDefinition(programBuckets),
  programCatalog: $Table.tableDefinition(programCatalog),
  quranRows: $Table.tableDefinition(quranRows),
  quranSearch: $Table.tableDefinition(quranSearch),
  schoolLogins: $Table.tableDefinition(schoolLogins),
  snapshotBatches: $Table.tableDefinition(snapshotBatches),
  subscriptions: $Table.tableDefinition(subscriptions),
  tenantAssignments: $Table.tableDefinition(tenantAssignments),
  tenantCohortMembers: $Table.tableDefinition(tenantCohortMembers),
  tenantCohorts: $Table.tableDefinition(tenantCohorts),
  tenantGraduates: $Table.tableDefinition(tenantGraduates),
  tenantGrants: $Table.tableDefinition(tenantGrants),
  tenantInvites: $Table.tableDefinition(tenantInvites),
  tenantKeys: $Table.tableDefinition(tenantKeys),
  tenantPeople: $Table.tableDefinition(tenantPeople),
  tenantPeriods: $Table.tableDefinition(tenantPeriods),
  tenantPromotionMoves: $Table.tableDefinition(tenantPromotionMoves),
  tenantPromotions: $Table.tableDefinition(tenantPromotions),
  tenantUnits: $Table.tableDefinition(tenantUnits),
  tenantVisits: $Table.tableDefinition(tenantVisits),
  tenants: $Table.tableDefinition(tenants),
  tryoutAttemptPlacements: $Table.tableDefinition(tryoutAttemptPlacements),
  tryoutAttempts: $Table.tableDefinition(tryoutAttempts),
  tryoutCatalog: $Table.tableDefinition(tryoutCatalog),
  tryoutPlacements: $Table.tableDefinition(tryoutPlacements),
  tryoutResponses: $Table.tableDefinition(tryoutResponses),
  tryoutRuntimeBundles: $Table.tableDefinition(tryoutRuntimeBundles),
  tryoutScores: $Table.tableDefinition(tryoutScores),
  tryoutSectionAttempts: $Table.tableDefinition(tryoutSectionAttempts),
  tryoutSetProgress: $Table.tableDefinition(tryoutSetProgress),
  userLearningRecents: $Table.tableDefinition(userLearningRecents),
  users: $Table.tableDefinition(users),
  vaultKeys: $Table.tableDefinition(vaultKeys),
  welcomeEmailIntents: $Table.tableDefinition(welcomeEmailIntents),
});
