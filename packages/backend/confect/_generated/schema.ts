import { DatabaseSchema as $DatabaseSchema } from "@confect/server";

import accountConsentDecisions from "./tables/accountConsentDecisions";
import accountConsents from "./tables/accountConsents";
import accountDeletionAttemptCancellations from "./tables/accountDeletionAttemptCancellations";
import accountDeletionPreparations from "./tables/accountDeletionPreparations";
import accountDeletionReceipts from "./tables/accountDeletionReceipts";
import articleBuckets from "./tables/articleBuckets";
import articleCatalog from "./tables/articleCatalog";
import articleCategories from "./tables/articleCategories";
import assessmentFlags from "./tables/assessmentFlags";
import billingAccounts from "./tables/billingAccounts";
import billingCheckouts from "./tables/billingCheckouts";
import billingCounters from "./tables/billingCounters";
import billingEvents from "./tables/billingEvents";
import billingGrants from "./tables/billingGrants";
import billingInvoices from "./tables/billingInvoices";
import billingPayments from "./tables/billingPayments";
import billingSubscriptions from "./tables/billingSubscriptions";
import chatShares from "./tables/chatShares";
import chats from "./tables/chats";
import classGrades from "./tables/classGrades";
import classTeachers from "./tables/classTeachers";
import classes from "./tables/classes";
import classroomChannels from "./tables/classroomChannels";
import classroomMessages from "./tables/classroomMessages";
import commentLikes from "./tables/commentLikes";
import comments from "./tables/comments";
import connectorConnections from "./tables/connectorConnections";
import connectorKeys from "./tables/connectorKeys";
import connectorSecrets from "./tables/connectorSecrets";
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
import creditLots from "./tables/creditLots";
import creditResetPeriods from "./tables/creditResetPeriods";
import creditTransactions from "./tables/creditTransactions";
import curriculumRoutes from "./tables/curriculumRoutes";
import editorClients from "./tables/editorClients";
import editorDocuments from "./tables/editorDocuments";
import editorSnapshots from "./tables/editorSnapshots";
import editorSteps from "./tables/editorSteps";
import examAnswers from "./tables/examAnswers";
import examAssets from "./tables/examAssets";
import examAttempts from "./tables/examAttempts";
import examQuestions from "./tables/examQuestions";
import examResults from "./tables/examResults";
import examSignals from "./tables/examSignals";
import examSittings from "./tables/examSittings";
import exams from "./tables/exams";
import gradingSchemes from "./tables/gradingSchemes";
import guardianCodes from "./tables/guardianCodes";
import guardianConsents from "./tables/guardianConsents";
import guardianLinks from "./tables/guardianLinks";
import integrationClients from "./tables/integrationClients";
import integrationTokens from "./tables/integrationTokens";
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
import rosterEntries from "./tables/rosterEntries";
import schoolLogins from "./tables/schoolLogins";
import snapshotBatches from "./tables/snapshotBatches";
import tenantAssignments from "./tables/tenantAssignments";
import tenantCohortMembers from "./tables/tenantCohortMembers";
import tenantCohorts from "./tables/tenantCohorts";
import tenantDrafts from "./tables/tenantDrafts";
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

const databaseSchema: $DatabaseSchema.DatabaseSchema<{
  readonly accountConsentDecisions: typeof accountConsentDecisions;
  readonly accountConsents: typeof accountConsents;
  readonly accountDeletionAttemptCancellations: typeof accountDeletionAttemptCancellations;
  readonly accountDeletionPreparations: typeof accountDeletionPreparations;
  readonly accountDeletionReceipts: typeof accountDeletionReceipts;
  readonly articleBuckets: typeof articleBuckets;
  readonly articleCatalog: typeof articleCatalog;
  readonly articleCategories: typeof articleCategories;
  readonly assessmentFlags: typeof assessmentFlags;
  readonly billingAccounts: typeof billingAccounts;
  readonly billingCheckouts: typeof billingCheckouts;
  readonly billingCounters: typeof billingCounters;
  readonly billingEvents: typeof billingEvents;
  readonly billingGrants: typeof billingGrants;
  readonly billingInvoices: typeof billingInvoices;
  readonly billingPayments: typeof billingPayments;
  readonly billingSubscriptions: typeof billingSubscriptions;
  readonly chatShares: typeof chatShares;
  readonly chats: typeof chats;
  readonly classGrades: typeof classGrades;
  readonly classTeachers: typeof classTeachers;
  readonly classes: typeof classes;
  readonly classroomChannels: typeof classroomChannels;
  readonly classroomMessages: typeof classroomMessages;
  readonly commentLikes: typeof commentLikes;
  readonly comments: typeof comments;
  readonly connectorConnections: typeof connectorConnections;
  readonly connectorKeys: typeof connectorKeys;
  readonly connectorSecrets: typeof connectorSecrets;
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
  readonly creditLots: typeof creditLots;
  readonly creditResetPeriods: typeof creditResetPeriods;
  readonly creditTransactions: typeof creditTransactions;
  readonly curriculumRoutes: typeof curriculumRoutes;
  readonly editorClients: typeof editorClients;
  readonly editorDocuments: typeof editorDocuments;
  readonly editorSnapshots: typeof editorSnapshots;
  readonly editorSteps: typeof editorSteps;
  readonly examAnswers: typeof examAnswers;
  readonly examAssets: typeof examAssets;
  readonly examAttempts: typeof examAttempts;
  readonly examQuestions: typeof examQuestions;
  readonly examResults: typeof examResults;
  readonly examSignals: typeof examSignals;
  readonly examSittings: typeof examSittings;
  readonly exams: typeof exams;
  readonly gradingSchemes: typeof gradingSchemes;
  readonly guardianCodes: typeof guardianCodes;
  readonly guardianConsents: typeof guardianConsents;
  readonly guardianLinks: typeof guardianLinks;
  readonly integrationClients: typeof integrationClients;
  readonly integrationTokens: typeof integrationTokens;
  readonly irtCalibrationRuns: typeof irtCalibrationRuns;
  readonly irtScaleItems: typeof irtScaleItems;
  readonly irtScaleVersions: typeof irtScaleVersions;
  readonly journalCursors: typeof journalCursors;
  readonly journalEntries: typeof journalEntries;
  readonly learningEngagementQueue: typeof learningEngagementQueue;
  readonly learningPopularityCounters: typeof learningPopularityCounters;
  readonly learningPopularityCycles: typeof learningPopularityCycles;
  readonly learningPopularitySignals: typeof learningPopularitySignals;
  readonly learningPopularityViewerSignals: typeof learningPopularityViewerSignals;
  readonly learningPreferences: typeof learningPreferences;
  readonly learningViews: typeof learningViews;
  readonly loginCards: typeof loginCards;
  readonly materialBuckets: typeof materialBuckets;
  readonly materialCatalog: typeof materialCatalog;
  readonly ninaMemories: typeof ninaMemories;
  readonly ninaMemoryKeys: typeof ninaMemoryKeys;
  readonly ninaMemoryPortraits: typeof ninaMemoryPortraits;
  readonly ninaMemoryRestores: typeof ninaMemoryRestores;
  readonly ninaSummaries: typeof ninaSummaries;
  readonly ninaTurns: typeof ninaTurns;
  readonly ninaUploads: typeof ninaUploads;
  readonly notifications: typeof notifications;
  readonly onboardingProfiles: typeof onboardingProfiles;
  readonly operators: typeof operators;
  readonly postLikes: typeof postLikes;
  readonly posts: typeof posts;
  readonly programBuckets: typeof programBuckets;
  readonly programCatalog: typeof programCatalog;
  readonly quranRows: typeof quranRows;
  readonly quranSearch: typeof quranSearch;
  readonly rosterEntries: typeof rosterEntries;
  readonly schoolLogins: typeof schoolLogins;
  readonly snapshotBatches: typeof snapshotBatches;
  readonly tenantAssignments: typeof tenantAssignments;
  readonly tenantCohortMembers: typeof tenantCohortMembers;
  readonly tenantCohorts: typeof tenantCohorts;
  readonly tenantDrafts: typeof tenantDrafts;
  readonly tenantGraduates: typeof tenantGraduates;
  readonly tenantGrants: typeof tenantGrants;
  readonly tenantInvites: typeof tenantInvites;
  readonly tenantKeys: typeof tenantKeys;
  readonly tenantPeople: typeof tenantPeople;
  readonly tenantPeriods: typeof tenantPeriods;
  readonly tenantPromotionMoves: typeof tenantPromotionMoves;
  readonly tenantPromotions: typeof tenantPromotions;
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
  assessmentFlags,
  billingAccounts,
  billingCheckouts,
  billingCounters,
  billingEvents,
  billingGrants,
  billingInvoices,
  billingPayments,
  billingSubscriptions,
  chatShares,
  chats,
  classGrades,
  classTeachers,
  classes,
  classroomChannels,
  classroomMessages,
  commentLikes,
  comments,
  connectorConnections,
  connectorKeys,
  connectorSecrets,
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
  creditLots,
  creditResetPeriods,
  creditTransactions,
  curriculumRoutes,
  editorClients,
  editorDocuments,
  editorSnapshots,
  editorSteps,
  examAnswers,
  examAssets,
  examAttempts,
  examQuestions,
  examResults,
  examSignals,
  examSittings,
  exams,
  gradingSchemes,
  guardianCodes,
  guardianConsents,
  guardianLinks,
  integrationClients,
  integrationTokens,
  irtCalibrationRuns,
  irtScaleItems,
  irtScaleVersions,
  journalCursors,
  journalEntries,
  learningEngagementQueue,
  learningPopularityCounters,
  learningPopularityCycles,
  learningPopularitySignals,
  learningPopularityViewerSignals,
  learningPreferences,
  learningViews,
  loginCards,
  materialBuckets,
  materialCatalog,
  ninaMemories,
  ninaMemoryKeys,
  ninaMemoryPortraits,
  ninaMemoryRestores,
  ninaSummaries,
  ninaTurns,
  ninaUploads,
  notifications,
  onboardingProfiles,
  operators,
  postLikes,
  posts,
  programBuckets,
  programCatalog,
  quranRows,
  quranSearch,
  rosterEntries,
  schoolLogins,
  snapshotBatches,
  tenantAssignments,
  tenantCohortMembers,
  tenantCohorts,
  tenantDrafts,
  tenantGraduates,
  tenantGrants,
  tenantInvites,
  tenantKeys,
  tenantPeople,
  tenantPeriods,
  tenantPromotionMoves,
  tenantPromotions,
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
