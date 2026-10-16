import { DatabaseSchema as $DatabaseSchema } from "@confect/server";

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
import classTeachers from "./tables/classTeachers";
import classes from "./tables/classes";
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
import editorDocuments from "./tables/editorDocuments";
import editorSnapshots from "./tables/editorSnapshots";
import editorSteps from "./tables/editorSteps";
import examQuestions from "./tables/examQuestions";
import exams from "./tables/exams";
import integrationClients from "./tables/integrationClients";
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
import ninaMemoryKeys from "./tables/ninaMemoryKeys";
import ninaMemoryPortraits from "./tables/ninaMemoryPortraits";
import ninaMemoryRestores from "./tables/ninaMemoryRestores";
import ninaSummaries from "./tables/ninaSummaries";
import ninaTurns from "./tables/ninaTurns";
import ninaUploads from "./tables/ninaUploads";
import onboardingProfiles from "./tables/onboardingProfiles";
import operators from "./tables/operators";
import programBuckets from "./tables/programBuckets";
import programCatalog from "./tables/programCatalog";
import quranRows from "./tables/quranRows";
import quranSearch from "./tables/quranSearch";
import snapshotBatches from "./tables/snapshotBatches";
import subscriptions from "./tables/subscriptions";
import tenantCohortMembers from "./tables/tenantCohortMembers";
import tenantCohorts from "./tables/tenantCohorts";
import tenantGrants from "./tables/tenantGrants";
import tenantInvites from "./tables/tenantInvites";
import tenantKeys from "./tables/tenantKeys";
import tenantPeople from "./tables/tenantPeople";
import tenantPeriods from "./tables/tenantPeriods";
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

const databaseSchema: $DatabaseSchema.DatabaseSchema<{
  readonly accountConsentDecisions: typeof accountConsentDecisions;
  readonly accountConsents: typeof accountConsents;
  readonly accountDeletionAttemptCancellations: typeof accountDeletionAttemptCancellations;
  readonly accountDeletionPreparations: typeof accountDeletionPreparations;
  readonly accountDeletionReceipts: typeof accountDeletionReceipts;
  readonly articleBuckets: typeof articleBuckets;
  readonly articleCatalog: typeof articleCatalog;
  readonly articleCategories: typeof articleCategories;
  readonly chatShares: typeof chatShares;
  readonly chats: typeof chats;
  readonly classTeachers: typeof classTeachers;
  readonly classes: typeof classes;
  readonly commentVotes: typeof commentVotes;
  readonly comments: typeof comments;
  readonly contentAnalyticsPartitions: typeof contentAnalyticsPartitions;
  readonly contentArtifactFacts: typeof contentArtifactFacts;
  readonly contentArtifacts: typeof contentArtifacts;
  readonly contentBindings: typeof contentBindings;
  readonly contentCompaction: typeof contentCompaction;
  readonly contentHeads: typeof contentHeads;
  readonly contentIndex: typeof contentIndex;
  readonly contentItems: typeof contentItems;
  readonly contentKeys: typeof contentKeys;
  readonly contentModelBuilds: typeof contentModelBuilds;
  readonly contentPaths: typeof contentPaths;
  readonly contentReleases: typeof contentReleases;
  readonly contentSectionSources: typeof contentSectionSources;
  readonly contentSectionState: typeof contentSectionState;
  readonly contentSections: typeof contentSections;
  readonly contentSnapshots: typeof contentSnapshots;
  readonly contentState: typeof contentState;
  readonly creditResetPeriods: typeof creditResetPeriods;
  readonly creditTransactions: typeof creditTransactions;
  readonly curriculumRoutes: typeof curriculumRoutes;
  readonly customerDeletionTombstones: typeof customerDeletionTombstones;
  readonly customers: typeof customers;
  readonly editorDocuments: typeof editorDocuments;
  readonly editorSnapshots: typeof editorSnapshots;
  readonly editorSteps: typeof editorSteps;
  readonly examQuestions: typeof examQuestions;
  readonly exams: typeof exams;
  readonly integrationClients: typeof integrationClients;
  readonly irtCalibrationRuns: typeof irtCalibrationRuns;
  readonly irtScaleItems: typeof irtScaleItems;
  readonly irtScaleVersions: typeof irtScaleVersions;
  readonly journalEntries: typeof journalEntries;
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
  readonly ninaMemoryKeys: typeof ninaMemoryKeys;
  readonly ninaMemoryPortraits: typeof ninaMemoryPortraits;
  readonly ninaMemoryRestores: typeof ninaMemoryRestores;
  readonly ninaSummaries: typeof ninaSummaries;
  readonly ninaTurns: typeof ninaTurns;
  readonly ninaUploads: typeof ninaUploads;
  readonly onboardingProfiles: typeof onboardingProfiles;
  readonly operators: typeof operators;
  readonly programBuckets: typeof programBuckets;
  readonly programCatalog: typeof programCatalog;
  readonly quranRows: typeof quranRows;
  readonly quranSearch: typeof quranSearch;
  readonly snapshotBatches: typeof snapshotBatches;
  readonly subscriptions: typeof subscriptions;
  readonly tenantCohortMembers: typeof tenantCohortMembers;
  readonly tenantCohorts: typeof tenantCohorts;
  readonly tenantGrants: typeof tenantGrants;
  readonly tenantInvites: typeof tenantInvites;
  readonly tenantKeys: typeof tenantKeys;
  readonly tenantPeople: typeof tenantPeople;
  readonly tenantPeriods: typeof tenantPeriods;
  readonly tenantUnits: typeof tenantUnits;
  readonly tenantVisits: typeof tenantVisits;
  readonly tenants: typeof tenants;
  readonly tryoutAttemptPlacements: typeof tryoutAttemptPlacements;
  readonly tryoutAttempts: typeof tryoutAttempts;
  readonly tryoutCatalog: typeof tryoutCatalog;
  readonly tryoutPlacements: typeof tryoutPlacements;
  readonly tryoutResponses: typeof tryoutResponses;
  readonly tryoutRuntimeBundles: typeof tryoutRuntimeBundles;
  readonly tryoutScores: typeof tryoutScores;
  readonly tryoutSectionAttempts: typeof tryoutSectionAttempts;
  readonly tryoutSetProgress: typeof tryoutSetProgress;
  readonly userLearningRecents: typeof userLearningRecents;
  readonly users: typeof users;
  readonly vaultKeys: typeof vaultKeys;
  readonly welcomeEmailIntents: typeof welcomeEmailIntents;
}> = $DatabaseSchema.make({
  accountConsentDecisions,
  accountConsents,
  accountDeletionAttemptCancellations,
  accountDeletionPreparations,
  accountDeletionReceipts,
  articleBuckets,
  articleCatalog,
  articleCategories,
  chatShares,
  chats,
  classTeachers,
  classes,
  commentVotes,
  comments,
  contentAnalyticsPartitions,
  contentArtifactFacts,
  contentArtifacts,
  contentBindings,
  contentCompaction,
  contentHeads,
  contentIndex,
  contentItems,
  contentKeys,
  contentModelBuilds,
  contentPaths,
  contentReleases,
  contentSectionSources,
  contentSectionState,
  contentSections,
  contentSnapshots,
  contentState,
  creditResetPeriods,
  creditTransactions,
  curriculumRoutes,
  customerDeletionTombstones,
  customers,
  editorDocuments,
  editorSnapshots,
  editorSteps,
  examQuestions,
  exams,
  integrationClients,
  irtCalibrationRuns,
  irtScaleItems,
  irtScaleVersions,
  journalEntries,
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
  ninaMemoryKeys,
  ninaMemoryPortraits,
  ninaMemoryRestores,
  ninaSummaries,
  ninaTurns,
  ninaUploads,
  onboardingProfiles,
  operators,
  programBuckets,
  programCatalog,
  quranRows,
  quranSearch,
  snapshotBatches,
  subscriptions,
  tenantCohortMembers,
  tenantCohorts,
  tenantGrants,
  tenantInvites,
  tenantKeys,
  tenantPeople,
  tenantPeriods,
  tenantUnits,
  tenantVisits,
  tenants,
  tryoutAttemptPlacements,
  tryoutAttempts,
  tryoutCatalog,
  tryoutPlacements,
  tryoutResponses,
  tryoutRuntimeBundles,
  tryoutScores,
  tryoutSectionAttempts,
  tryoutSetProgress,
  userLearningRecents,
  users,
  vaultKeys,
  welcomeEmailIntents,
});

export default databaseSchema;
