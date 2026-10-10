import { defineSchema as $defineSchema } from "convex/server";
import { Table as $Table } from "@confect/server";

import accountConsentDecisions from "./tables/accountConsentDecisions";
import accountConsents from "./tables/accountConsents";
import accountDeletionAttemptCancellations from "./tables/accountDeletionAttemptCancellations";
import accountDeletionPreparations from "./tables/accountDeletionPreparations";
import accountDeletionReceipts from "./tables/accountDeletionReceipts";
import accountDeletionSchoolTransfers from "./tables/accountDeletionSchoolTransfers";
import articleBuckets from "./tables/articleBuckets";
import articleCatalog from "./tables/articleCatalog";
import articleCategories from "./tables/articleCategories";
import chats from "./tables/chats";
import commentVotes from "./tables/commentVotes";
import comments from "./tables/comments";
import contentAnalyticsPartitions from "./tables/contentAnalyticsPartitions";
import contentArtifactFacts from "./tables/contentArtifactFacts";
import contentArtifacts from "./tables/contentArtifacts";
import contentBindings from "./tables/contentBindings";
import contentHeads from "./tables/contentHeads";
import contentIndex from "./tables/contentIndex";
import contentItems from "./tables/contentItems";
import contentKeys from "./tables/contentKeys";
import contentModelBuilds from "./tables/contentModelBuilds";
import contentPaths from "./tables/contentPaths";
import contentReleases from "./tables/contentReleases";
import contentSnapshots from "./tables/contentSnapshots";
import contentState from "./tables/contentState";
import creditResetPeriods from "./tables/creditResetPeriods";
import creditTransactions from "./tables/creditTransactions";
import curriculumRoutes from "./tables/curriculumRoutes";
import customerDeletionTombstones from "./tables/customerDeletionTombstones";
import customers from "./tables/customers";
import irtCalibrationRuns from "./tables/irtCalibrationRuns";
import irtScaleItems from "./tables/irtScaleItems";
import irtScaleVersions from "./tables/irtScaleVersions";
import journalEntries from "./tables/journalEntries";
import learningEngagementQueue from "./tables/learningEngagementQueue";
import learningPopularityCounters from "./tables/learningPopularityCounters";
import learningPopularityCycles from "./tables/learningPopularityCycles";
import learningPopularitySignals from "./tables/learningPopularitySignals";
import learningPopularityViewerSignals from "./tables/learningPopularityViewerSignals";
import learningPreferences from "./tables/learningPreferences";
import learningViews from "./tables/learningViews";
import materialBuckets from "./tables/materialBuckets";
import materialCatalog from "./tables/materialCatalog";
import ninaMemories from "./tables/ninaMemories";
import ninaSummaries from "./tables/ninaSummaries";
import ninaTurns from "./tables/ninaTurns";
import ninaUploads from "./tables/ninaUploads";
import onboardingProfiles from "./tables/onboardingProfiles";
import programBuckets from "./tables/programBuckets";
import programCatalog from "./tables/programCatalog";
import quranRows from "./tables/quranRows";
import quranSearch from "./tables/quranSearch";
import schoolActivityLogs from "./tables/schoolActivityLogs";
import schoolClassForumPendingUploads from "./tables/schoolClassForumPendingUploads";
import schoolClassForumPostAttachments from "./tables/schoolClassForumPostAttachments";
import schoolClassForumPostReactions from "./tables/schoolClassForumPostReactions";
import schoolClassForumPosts from "./tables/schoolClassForumPosts";
import schoolClassForumReactions from "./tables/schoolClassForumReactions";
import schoolClassForumReadStates from "./tables/schoolClassForumReadStates";
import schoolClassForums from "./tables/schoolClassForums";
import schoolClassInviteCodes from "./tables/schoolClassInviteCodes";
import schoolClassMaterialGroups from "./tables/schoolClassMaterialGroups";
import schoolClassMembers from "./tables/schoolClassMembers";
import schoolClasses from "./tables/schoolClasses";
import schoolInviteCodes from "./tables/schoolInviteCodes";
import schoolMembers from "./tables/schoolMembers";
import schools from "./tables/schools";
import snapshotBatches from "./tables/snapshotBatches";
import subscriptions from "./tables/subscriptions";
import tenantGrants from "./tables/tenantGrants";
import tenantInvites from "./tables/tenantInvites";
import tenantPeople from "./tables/tenantPeople";
import tenantUnits from "./tables/tenantUnits";
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
import welcomeEmailIntents from "./tables/welcomeEmailIntents";

export default $defineSchema({
  accountConsentDecisions: $Table.tableDefinition(accountConsentDecisions),
  accountConsents: $Table.tableDefinition(accountConsents),
  accountDeletionAttemptCancellations: $Table.tableDefinition(accountDeletionAttemptCancellations),
  accountDeletionPreparations: $Table.tableDefinition(accountDeletionPreparations),
  accountDeletionReceipts: $Table.tableDefinition(accountDeletionReceipts),
  accountDeletionSchoolTransfers: $Table.tableDefinition(accountDeletionSchoolTransfers),
  articleBuckets: $Table.tableDefinition(articleBuckets),
  articleCatalog: $Table.tableDefinition(articleCatalog),
  articleCategories: $Table.tableDefinition(articleCategories),
  chats: $Table.tableDefinition(chats),
  commentVotes: $Table.tableDefinition(commentVotes),
  comments: $Table.tableDefinition(comments),
  contentAnalyticsPartitions: $Table.tableDefinition(contentAnalyticsPartitions),
  contentArtifactFacts: $Table.tableDefinition(contentArtifactFacts),
  contentArtifacts: $Table.tableDefinition(contentArtifacts),
  contentBindings: $Table.tableDefinition(contentBindings),
  contentHeads: $Table.tableDefinition(contentHeads),
  contentIndex: $Table.tableDefinition(contentIndex),
  contentItems: $Table.tableDefinition(contentItems),
  contentKeys: $Table.tableDefinition(contentKeys),
  contentModelBuilds: $Table.tableDefinition(contentModelBuilds),
  contentPaths: $Table.tableDefinition(contentPaths),
  contentReleases: $Table.tableDefinition(contentReleases),
  contentSnapshots: $Table.tableDefinition(contentSnapshots),
  contentState: $Table.tableDefinition(contentState),
  creditResetPeriods: $Table.tableDefinition(creditResetPeriods),
  creditTransactions: $Table.tableDefinition(creditTransactions),
  curriculumRoutes: $Table.tableDefinition(curriculumRoutes),
  customerDeletionTombstones: $Table.tableDefinition(customerDeletionTombstones),
  customers: $Table.tableDefinition(customers),
  irtCalibrationRuns: $Table.tableDefinition(irtCalibrationRuns),
  irtScaleItems: $Table.tableDefinition(irtScaleItems),
  irtScaleVersions: $Table.tableDefinition(irtScaleVersions),
  journalEntries: $Table.tableDefinition(journalEntries),
  learningEngagementQueue: $Table.tableDefinition(learningEngagementQueue),
  learningPopularityCounters: $Table.tableDefinition(learningPopularityCounters),
  learningPopularityCycles: $Table.tableDefinition(learningPopularityCycles),
  learningPopularitySignals: $Table.tableDefinition(learningPopularitySignals),
  learningPopularityViewerSignals: $Table.tableDefinition(learningPopularityViewerSignals),
  learningPreferences: $Table.tableDefinition(learningPreferences),
  learningViews: $Table.tableDefinition(learningViews),
  materialBuckets: $Table.tableDefinition(materialBuckets),
  materialCatalog: $Table.tableDefinition(materialCatalog),
  ninaMemories: $Table.tableDefinition(ninaMemories),
  ninaSummaries: $Table.tableDefinition(ninaSummaries),
  ninaTurns: $Table.tableDefinition(ninaTurns),
  ninaUploads: $Table.tableDefinition(ninaUploads),
  onboardingProfiles: $Table.tableDefinition(onboardingProfiles),
  programBuckets: $Table.tableDefinition(programBuckets),
  programCatalog: $Table.tableDefinition(programCatalog),
  quranRows: $Table.tableDefinition(quranRows),
  quranSearch: $Table.tableDefinition(quranSearch),
  schoolActivityLogs: $Table.tableDefinition(schoolActivityLogs),
  schoolClassForumPendingUploads: $Table.tableDefinition(schoolClassForumPendingUploads),
  schoolClassForumPostAttachments: $Table.tableDefinition(schoolClassForumPostAttachments),
  schoolClassForumPostReactions: $Table.tableDefinition(schoolClassForumPostReactions),
  schoolClassForumPosts: $Table.tableDefinition(schoolClassForumPosts),
  schoolClassForumReactions: $Table.tableDefinition(schoolClassForumReactions),
  schoolClassForumReadStates: $Table.tableDefinition(schoolClassForumReadStates),
  schoolClassForums: $Table.tableDefinition(schoolClassForums),
  schoolClassInviteCodes: $Table.tableDefinition(schoolClassInviteCodes),
  schoolClassMaterialGroups: $Table.tableDefinition(schoolClassMaterialGroups),
  schoolClassMembers: $Table.tableDefinition(schoolClassMembers),
  schoolClasses: $Table.tableDefinition(schoolClasses),
  schoolInviteCodes: $Table.tableDefinition(schoolInviteCodes),
  schoolMembers: $Table.tableDefinition(schoolMembers),
  schools: $Table.tableDefinition(schools),
  snapshotBatches: $Table.tableDefinition(snapshotBatches),
  subscriptions: $Table.tableDefinition(subscriptions),
  tenantGrants: $Table.tableDefinition(tenantGrants),
  tenantInvites: $Table.tableDefinition(tenantInvites),
  tenantPeople: $Table.tableDefinition(tenantPeople),
  tenantUnits: $Table.tableDefinition(tenantUnits),
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
  welcomeEmailIntents: $Table.tableDefinition(welcomeEmailIntents),
});
