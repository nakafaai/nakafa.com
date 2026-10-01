import { DatabaseSchema as $DatabaseSchema } from "@confect/server";

import accountConsentDecisions from "./tables/accountConsentDecisions";
import accountConsents from "./tables/accountConsents";
import accountDeletionAttemptCancellations from "./tables/accountDeletionAttemptCancellations";
import accountDeletionPreparations from "./tables/accountDeletionPreparations";
import accountDeletionReceipts from "./tables/accountDeletionReceipts";
import accountDeletionSchoolTransfers from "./tables/accountDeletionSchoolTransfers";
import articleBuckets from "./tables/articleBuckets";
import articleCatalog from "./tables/articleCatalog";
import articleCategories from "./tables/articleCategories";
import bookmarkCollections from "./tables/bookmarkCollections";
import bookmarks from "./tables/bookmarks";
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
import tryoutAttemptPlacements from "./tables/tryoutAttemptPlacements";
import tryoutAttempts from "./tables/tryoutAttempts";
import tryoutCatalog from "./tables/tryoutCatalog";
import tryoutFlags from "./tables/tryoutFlags";
import tryoutPlacements from "./tables/tryoutPlacements";
import tryoutResponses from "./tables/tryoutResponses";
import tryoutRuntimeBundles from "./tables/tryoutRuntimeBundles";
import tryoutScores from "./tables/tryoutScores";
import tryoutSectionAttempts from "./tables/tryoutSectionAttempts";
import tryoutSetProgress from "./tables/tryoutSetProgress";
import userLearningRecents from "./tables/userLearningRecents";
import users from "./tables/users";
import welcomeEmailIntents from "./tables/welcomeEmailIntents";

const databaseSchema: $DatabaseSchema.DatabaseSchema<{
  readonly accountConsentDecisions: typeof accountConsentDecisions;
  readonly accountConsents: typeof accountConsents;
  readonly accountDeletionAttemptCancellations: typeof accountDeletionAttemptCancellations;
  readonly accountDeletionPreparations: typeof accountDeletionPreparations;
  readonly accountDeletionReceipts: typeof accountDeletionReceipts;
  readonly accountDeletionSchoolTransfers: typeof accountDeletionSchoolTransfers;
  readonly articleBuckets: typeof articleBuckets;
  readonly articleCatalog: typeof articleCatalog;
  readonly articleCategories: typeof articleCategories;
  readonly bookmarkCollections: typeof bookmarkCollections;
  readonly bookmarks: typeof bookmarks;
  readonly chats: typeof chats;
  readonly commentVotes: typeof commentVotes;
  readonly comments: typeof comments;
  readonly contentAnalyticsPartitions: typeof contentAnalyticsPartitions;
  readonly contentArtifactFacts: typeof contentArtifactFacts;
  readonly contentArtifacts: typeof contentArtifacts;
  readonly contentBindings: typeof contentBindings;
  readonly contentHeads: typeof contentHeads;
  readonly contentIndex: typeof contentIndex;
  readonly contentItems: typeof contentItems;
  readonly contentKeys: typeof contentKeys;
  readonly contentModelBuilds: typeof contentModelBuilds;
  readonly contentPaths: typeof contentPaths;
  readonly contentReleases: typeof contentReleases;
  readonly contentSnapshots: typeof contentSnapshots;
  readonly contentState: typeof contentState;
  readonly creditResetPeriods: typeof creditResetPeriods;
  readonly creditTransactions: typeof creditTransactions;
  readonly curriculumRoutes: typeof curriculumRoutes;
  readonly customerDeletionTombstones: typeof customerDeletionTombstones;
  readonly customers: typeof customers;
  readonly irtCalibrationRuns: typeof irtCalibrationRuns;
  readonly irtScaleItems: typeof irtScaleItems;
  readonly irtScaleVersions: typeof irtScaleVersions;
  readonly learningEngagementQueue: typeof learningEngagementQueue;
  readonly learningPopularityCounters: typeof learningPopularityCounters;
  readonly learningPopularityCycles: typeof learningPopularityCycles;
  readonly learningPopularitySignals: typeof learningPopularitySignals;
  readonly learningPopularityViewerSignals: typeof learningPopularityViewerSignals;
  readonly learningPreferences: typeof learningPreferences;
  readonly learningViews: typeof learningViews;
  readonly materialBuckets: typeof materialBuckets;
  readonly materialCatalog: typeof materialCatalog;
  readonly ninaMemories: typeof ninaMemories;
  readonly ninaSummaries: typeof ninaSummaries;
  readonly ninaTurns: typeof ninaTurns;
  readonly ninaUploads: typeof ninaUploads;
  readonly onboardingProfiles: typeof onboardingProfiles;
  readonly programBuckets: typeof programBuckets;
  readonly programCatalog: typeof programCatalog;
  readonly quranRows: typeof quranRows;
  readonly quranSearch: typeof quranSearch;
  readonly schoolActivityLogs: typeof schoolActivityLogs;
  readonly schoolClassForumPendingUploads: typeof schoolClassForumPendingUploads;
  readonly schoolClassForumPostAttachments: typeof schoolClassForumPostAttachments;
  readonly schoolClassForumPostReactions: typeof schoolClassForumPostReactions;
  readonly schoolClassForumPosts: typeof schoolClassForumPosts;
  readonly schoolClassForumReactions: typeof schoolClassForumReactions;
  readonly schoolClassForumReadStates: typeof schoolClassForumReadStates;
  readonly schoolClassForums: typeof schoolClassForums;
  readonly schoolClassInviteCodes: typeof schoolClassInviteCodes;
  readonly schoolClassMaterialGroups: typeof schoolClassMaterialGroups;
  readonly schoolClassMembers: typeof schoolClassMembers;
  readonly schoolClasses: typeof schoolClasses;
  readonly schoolInviteCodes: typeof schoolInviteCodes;
  readonly schoolMembers: typeof schoolMembers;
  readonly schools: typeof schools;
  readonly snapshotBatches: typeof snapshotBatches;
  readonly subscriptions: typeof subscriptions;
  readonly tryoutAttemptPlacements: typeof tryoutAttemptPlacements;
  readonly tryoutAttempts: typeof tryoutAttempts;
  readonly tryoutCatalog: typeof tryoutCatalog;
  readonly tryoutFlags: typeof tryoutFlags;
  readonly tryoutPlacements: typeof tryoutPlacements;
  readonly tryoutResponses: typeof tryoutResponses;
  readonly tryoutRuntimeBundles: typeof tryoutRuntimeBundles;
  readonly tryoutScores: typeof tryoutScores;
  readonly tryoutSectionAttempts: typeof tryoutSectionAttempts;
  readonly tryoutSetProgress: typeof tryoutSetProgress;
  readonly userLearningRecents: typeof userLearningRecents;
  readonly users: typeof users;
  readonly welcomeEmailIntents: typeof welcomeEmailIntents;
}> = $DatabaseSchema.make({
  accountConsentDecisions,
  accountConsents,
  accountDeletionAttemptCancellations,
  accountDeletionPreparations,
  accountDeletionReceipts,
  accountDeletionSchoolTransfers,
  articleBuckets,
  articleCatalog,
  articleCategories,
  bookmarkCollections,
  bookmarks,
  chats,
  commentVotes,
  comments,
  contentAnalyticsPartitions,
  contentArtifactFacts,
  contentArtifacts,
  contentBindings,
  contentHeads,
  contentIndex,
  contentItems,
  contentKeys,
  contentModelBuilds,
  contentPaths,
  contentReleases,
  contentSnapshots,
  contentState,
  creditResetPeriods,
  creditTransactions,
  curriculumRoutes,
  customerDeletionTombstones,
  customers,
  irtCalibrationRuns,
  irtScaleItems,
  irtScaleVersions,
  learningEngagementQueue,
  learningPopularityCounters,
  learningPopularityCycles,
  learningPopularitySignals,
  learningPopularityViewerSignals,
  learningPreferences,
  learningViews,
  materialBuckets,
  materialCatalog,
  ninaMemories,
  ninaSummaries,
  ninaTurns,
  ninaUploads,
  onboardingProfiles,
  programBuckets,
  programCatalog,
  quranRows,
  quranSearch,
  schoolActivityLogs,
  schoolClassForumPendingUploads,
  schoolClassForumPostAttachments,
  schoolClassForumPostReactions,
  schoolClassForumPosts,
  schoolClassForumReactions,
  schoolClassForumReadStates,
  schoolClassForums,
  schoolClassInviteCodes,
  schoolClassMaterialGroups,
  schoolClassMembers,
  schoolClasses,
  schoolInviteCodes,
  schoolMembers,
  schools,
  snapshotBatches,
  subscriptions,
  tryoutAttemptPlacements,
  tryoutAttempts,
  tryoutCatalog,
  tryoutFlags,
  tryoutPlacements,
  tryoutResponses,
  tryoutRuntimeBundles,
  tryoutScores,
  tryoutSectionAttempts,
  tryoutSetProgress,
  userLearningRecents,
  users,
  welcomeEmailIntents,
});

export default databaseSchema;
