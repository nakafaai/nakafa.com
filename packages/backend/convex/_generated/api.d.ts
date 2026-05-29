/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as assessments_mutations_internalFunctions_publishing from "../assessments/mutations/internalFunctions/publishing.js";
import type * as assessments_mutations_publicFunctions_assign from "../assessments/mutations/publicFunctions/assign.js";
import type * as assessments_mutations_publicFunctions_bank from "../assessments/mutations/publicFunctions/bank.js";
import type * as assessments_mutations_publicFunctions_create from "../assessments/mutations/publicFunctions/create.js";
import type * as assessments_mutations_publicFunctions_deleteFunctions from "../assessments/mutations/publicFunctions/deleteFunctions.js";
import type * as assessments_mutations_publicFunctions_questions from "../assessments/mutations/publicFunctions/questions.js";
import type * as assessments_mutations_publicFunctions_reorder from "../assessments/mutations/publicFunctions/reorder.js";
import type * as assessments_mutations_publicFunctions_save from "../assessments/mutations/publicFunctions/save.js";
import type * as assessments_mutations_publicFunctions_sections from "../assessments/mutations/publicFunctions/sections.js";
import type * as assessments_mutations_publicFunctions_start from "../assessments/mutations/publicFunctions/start.js";
import type * as assessments_mutations_publicFunctions_submit from "../assessments/mutations/publicFunctions/submit.js";
import type * as assessments_mutations_publicFunctions_update from "../assessments/mutations/publicFunctions/update.js";
import type * as assessments_mutations_publicFunctions_version from "../assessments/mutations/publicFunctions/version.js";
import type * as assessments_queries_publicFunctions_assignment from "../assessments/queries/publicFunctions/assignment.js";
import type * as assessments_queries_publicFunctions_authoring from "../assessments/queries/publicFunctions/authoring.js";
import type * as assessments_queries_publicFunctions_bank from "../assessments/queries/publicFunctions/bank.js";
import type * as assessments_queries_publicFunctions_list from "../assessments/queries/publicFunctions/list.js";
import type * as audioStudies_actions from "../audioStudies/actions.js";
import type * as audioStudies_mutations_contentAudios from "../audioStudies/mutations/contentAudios.js";
import type * as audioStudies_mutations_queue from "../audioStudies/mutations/queue.js";
import type * as audioStudies_queries_internalFunctions from "../audioStudies/queries/internalFunctions.js";
import type * as audioStudies_queries_publicFunctions from "../audioStudies/queries/publicFunctions.js";
import type * as audioStudies_workflows from "../audioStudies/workflows.js";
import type * as auth from "../auth.js";
import type * as auth_cleanup from "../auth/cleanup.js";
import type * as auth_sync from "../auth/sync.js";
import type * as chats_actions from "../chats/actions.js";
import type * as chats_mutations from "../chats/mutations.js";
import type * as chats_queries from "../chats/queries.js";
import type * as classes_forums_internalMutations from "../classes/forums/internalMutations.js";
import type * as classes_forums_mutations_forums from "../classes/forums/mutations/forums.js";
import type * as classes_forums_mutations_posts from "../classes/forums/mutations/posts.js";
import type * as classes_forums_mutations_reactions from "../classes/forums/mutations/reactions.js";
import type * as classes_forums_mutations_readState from "../classes/forums/mutations/readState.js";
import type * as classes_forums_mutations_uploads from "../classes/forums/mutations/uploads.js";
import type * as classes_forums_queries_forums from "../classes/forums/queries/forums.js";
import type * as classes_forums_queries_pages from "../classes/forums/queries/pages.js";
import type * as classes_materials_mutations from "../classes/materials/mutations.js";
import type * as classes_materials_queries from "../classes/materials/queries.js";
import type * as classes_mutations from "../classes/mutations.js";
import type * as classes_queries from "../classes/queries.js";
import type * as comments_mutations from "../comments/mutations.js";
import type * as comments_queries from "../comments/queries.js";
import type * as contentSync_mutations_articles from "../contentSync/mutations/articles.js";
import type * as contentSync_mutations_authors from "../contentSync/mutations/authors.js";
import type * as contentSync_mutations_exercises from "../contentSync/mutations/exercises.js";
import type * as contentSync_mutations_maintenance from "../contentSync/mutations/maintenance.js";
import type * as contentSync_mutations_subjects from "../contentSync/mutations/subjects.js";
import type * as contentSync_mutations_tryouts from "../contentSync/mutations/tryouts.js";
import type * as contentSync_queries_authors from "../contentSync/queries/authors.js";
import type * as contentSync_queries_counts from "../contentSync/queries/counts.js";
import type * as contentSync_queries_integrity from "../contentSync/queries/integrity.js";
import type * as contentSync_queries_stale from "../contentSync/queries/stale.js";
import type * as contentSync_queries_tryouts from "../contentSync/queries/tryouts.js";
import type * as contents_actions_queue from "../contents/actions/queue.js";
import type * as contents_mutations_analytics from "../contents/mutations/analytics.js";
import type * as contents_mutations_audio from "../contents/mutations/audio.js";
import type * as contents_mutations_search from "../contents/mutations/search.js";
import type * as contents_mutations_views from "../contents/mutations/views.js";
import type * as contents_queries_audio from "../contents/queries/audio.js";
import type * as contents_queries_recent from "../contents/queries/recent.js";
import type * as contents_queries_search from "../contents/queries/search.js";
import type * as credits_mutations from "../credits/mutations.js";
import type * as crons from "../crons.js";
import type * as customers_actions_internalFunctions from "../customers/actions/internalFunctions.js";
import type * as customers_actions_publicFunctions from "../customers/actions/publicFunctions.js";
import type * as customers_mutations_internalFunctions from "../customers/mutations/internalFunctions.js";
import type * as customers_queries_internalFunctions_customer from "../customers/queries/internalFunctions/customer.js";
import type * as customers_queries_internalFunctions_maintenance from "../customers/queries/internalFunctions/maintenance.js";
import type * as emails_mutations from "../emails/mutations.js";
import type * as exercises_mutations from "../exercises/mutations.js";
import type * as exercises_queries from "../exercises/queries.js";
import type * as http from "../http.js";
import type * as irt_actions_internalFunctions_calibration from "../irt/actions/internalFunctions/calibration.js";
import type * as irt_mutations_internalFunctions_cache from "../irt/mutations/internalFunctions/cache.js";
import type * as irt_mutations_internalFunctions_queue from "../irt/mutations/internalFunctions/queue.js";
import type * as irt_mutations_internalFunctions_responses from "../irt/mutations/internalFunctions/responses.js";
import type * as irt_mutations_internalFunctions_runs from "../irt/mutations/internalFunctions/runs.js";
import type * as irt_mutations_internalFunctions_scales from "../irt/mutations/internalFunctions/scales.js";
import type * as irt_queries_internalFunctions_calibration from "../irt/queries/internalFunctions/calibration.js";
import type * as irt_queries_internalFunctions_maintenance from "../irt/queries/internalFunctions/maintenance.js";
import type * as irt_workflows from "../irt/workflows.js";
import type * as node_audioStudies_actions from "../node/audioStudies/actions.js";
import type * as notifications_mutations from "../notifications/mutations.js";
import type * as notifications_queries from "../notifications/queries.js";
import type * as schools_mutations from "../schools/mutations.js";
import type * as schools_queries from "../schools/queries.js";
import type * as subjectSections_queries from "../subjectSections/queries.js";
import type * as subscriptions_mutations from "../subscriptions/mutations.js";
import type * as subscriptions_queries from "../subscriptions/queries.js";
import type * as triggers_chats_cleanup from "../triggers/chats/cleanup.js";
import type * as triggers_comments_cleanup from "../triggers/comments/cleanup.js";
import type * as triggers_materials_cleanup from "../triggers/materials/cleanup.js";
import type * as triggers_schools_cleanup from "../triggers/schools/cleanup.js";
import type * as tryoutAccess_mutations_internalFunctions_competition from "../tryoutAccess/mutations/internalFunctions/competition.js";
import type * as tryoutAccess_mutations_internalFunctions_status from "../tryoutAccess/mutations/internalFunctions/status.js";
import type * as tryoutAccess_mutations_redeem from "../tryoutAccess/mutations/redeem.js";
import type * as tryoutAccess_mutations_setup from "../tryoutAccess/mutations/setup.js";
import type * as tryoutAccess_queries_internalFunctions_maintenance from "../tryoutAccess/queries/internalFunctions/maintenance.js";
import type * as tryoutAccess_queries_page from "../tryoutAccess/queries/page.js";
import type * as tryouts_mutations_attempts from "../tryouts/mutations/attempts.js";
import type * as tryouts_mutations_internalFunctions_expiry from "../tryouts/mutations/internalFunctions/expiry.js";
import type * as tryouts_mutations_internalFunctions_leaderboard from "../tryouts/mutations/internalFunctions/leaderboard.js";
import type * as tryouts_mutations_internalFunctions_scoring from "../tryouts/mutations/internalFunctions/scoring.js";
import type * as tryouts_mutations_internalFunctions_stats from "../tryouts/mutations/internalFunctions/stats.js";
import type * as tryouts_queries_leaderboard from "../tryouts/queries/leaderboard.js";
import type * as tryouts_queries_me_attempt from "../tryouts/queries/me/attempt.js";
import type * as tryouts_queries_me_history from "../tryouts/queries/me/history.js";
import type * as tryouts_queries_me_part from "../tryouts/queries/me/part.js";
import type * as tryouts_queries_me_session from "../tryouts/queries/me/session.js";
import type * as tryouts_queries_me_setView from "../tryouts/queries/me/setView.js";
import type * as tryouts_queries_tryouts from "../tryouts/queries/tryouts.js";
import type * as users_mutations from "../users/mutations.js";
import type * as users_queries from "../users/queries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "assessments/mutations/internalFunctions/publishing": typeof assessments_mutations_internalFunctions_publishing;
  "assessments/mutations/publicFunctions/assign": typeof assessments_mutations_publicFunctions_assign;
  "assessments/mutations/publicFunctions/bank": typeof assessments_mutations_publicFunctions_bank;
  "assessments/mutations/publicFunctions/create": typeof assessments_mutations_publicFunctions_create;
  "assessments/mutations/publicFunctions/deleteFunctions": typeof assessments_mutations_publicFunctions_deleteFunctions;
  "assessments/mutations/publicFunctions/questions": typeof assessments_mutations_publicFunctions_questions;
  "assessments/mutations/publicFunctions/reorder": typeof assessments_mutations_publicFunctions_reorder;
  "assessments/mutations/publicFunctions/save": typeof assessments_mutations_publicFunctions_save;
  "assessments/mutations/publicFunctions/sections": typeof assessments_mutations_publicFunctions_sections;
  "assessments/mutations/publicFunctions/start": typeof assessments_mutations_publicFunctions_start;
  "assessments/mutations/publicFunctions/submit": typeof assessments_mutations_publicFunctions_submit;
  "assessments/mutations/publicFunctions/update": typeof assessments_mutations_publicFunctions_update;
  "assessments/mutations/publicFunctions/version": typeof assessments_mutations_publicFunctions_version;
  "assessments/queries/publicFunctions/assignment": typeof assessments_queries_publicFunctions_assignment;
  "assessments/queries/publicFunctions/authoring": typeof assessments_queries_publicFunctions_authoring;
  "assessments/queries/publicFunctions/bank": typeof assessments_queries_publicFunctions_bank;
  "assessments/queries/publicFunctions/list": typeof assessments_queries_publicFunctions_list;
  "audioStudies/actions": typeof audioStudies_actions;
  "audioStudies/mutations/contentAudios": typeof audioStudies_mutations_contentAudios;
  "audioStudies/mutations/queue": typeof audioStudies_mutations_queue;
  "audioStudies/queries/internalFunctions": typeof audioStudies_queries_internalFunctions;
  "audioStudies/queries/publicFunctions": typeof audioStudies_queries_publicFunctions;
  "audioStudies/workflows": typeof audioStudies_workflows;
  auth: typeof auth;
  "auth/cleanup": typeof auth_cleanup;
  "auth/sync": typeof auth_sync;
  "chats/actions": typeof chats_actions;
  "chats/mutations": typeof chats_mutations;
  "chats/queries": typeof chats_queries;
  "classes/forums/internalMutations": typeof classes_forums_internalMutations;
  "classes/forums/mutations/forums": typeof classes_forums_mutations_forums;
  "classes/forums/mutations/posts": typeof classes_forums_mutations_posts;
  "classes/forums/mutations/reactions": typeof classes_forums_mutations_reactions;
  "classes/forums/mutations/readState": typeof classes_forums_mutations_readState;
  "classes/forums/mutations/uploads": typeof classes_forums_mutations_uploads;
  "classes/forums/queries/forums": typeof classes_forums_queries_forums;
  "classes/forums/queries/pages": typeof classes_forums_queries_pages;
  "classes/materials/mutations": typeof classes_materials_mutations;
  "classes/materials/queries": typeof classes_materials_queries;
  "classes/mutations": typeof classes_mutations;
  "classes/queries": typeof classes_queries;
  "comments/mutations": typeof comments_mutations;
  "comments/queries": typeof comments_queries;
  "contentSync/mutations/articles": typeof contentSync_mutations_articles;
  "contentSync/mutations/authors": typeof contentSync_mutations_authors;
  "contentSync/mutations/exercises": typeof contentSync_mutations_exercises;
  "contentSync/mutations/maintenance": typeof contentSync_mutations_maintenance;
  "contentSync/mutations/subjects": typeof contentSync_mutations_subjects;
  "contentSync/mutations/tryouts": typeof contentSync_mutations_tryouts;
  "contentSync/queries/authors": typeof contentSync_queries_authors;
  "contentSync/queries/counts": typeof contentSync_queries_counts;
  "contentSync/queries/integrity": typeof contentSync_queries_integrity;
  "contentSync/queries/stale": typeof contentSync_queries_stale;
  "contentSync/queries/tryouts": typeof contentSync_queries_tryouts;
  "contents/actions/queue": typeof contents_actions_queue;
  "contents/mutations/analytics": typeof contents_mutations_analytics;
  "contents/mutations/audio": typeof contents_mutations_audio;
  "contents/mutations/search": typeof contents_mutations_search;
  "contents/mutations/views": typeof contents_mutations_views;
  "contents/queries/audio": typeof contents_queries_audio;
  "contents/queries/recent": typeof contents_queries_recent;
  "contents/queries/search": typeof contents_queries_search;
  "credits/mutations": typeof credits_mutations;
  crons: typeof crons;
  "customers/actions/internalFunctions": typeof customers_actions_internalFunctions;
  "customers/actions/publicFunctions": typeof customers_actions_publicFunctions;
  "customers/mutations/internalFunctions": typeof customers_mutations_internalFunctions;
  "customers/queries/internalFunctions/customer": typeof customers_queries_internalFunctions_customer;
  "customers/queries/internalFunctions/maintenance": typeof customers_queries_internalFunctions_maintenance;
  "emails/mutations": typeof emails_mutations;
  "exercises/mutations": typeof exercises_mutations;
  "exercises/queries": typeof exercises_queries;
  http: typeof http;
  "irt/actions/internalFunctions/calibration": typeof irt_actions_internalFunctions_calibration;
  "irt/mutations/internalFunctions/cache": typeof irt_mutations_internalFunctions_cache;
  "irt/mutations/internalFunctions/queue": typeof irt_mutations_internalFunctions_queue;
  "irt/mutations/internalFunctions/responses": typeof irt_mutations_internalFunctions_responses;
  "irt/mutations/internalFunctions/runs": typeof irt_mutations_internalFunctions_runs;
  "irt/mutations/internalFunctions/scales": typeof irt_mutations_internalFunctions_scales;
  "irt/queries/internalFunctions/calibration": typeof irt_queries_internalFunctions_calibration;
  "irt/queries/internalFunctions/maintenance": typeof irt_queries_internalFunctions_maintenance;
  "irt/workflows": typeof irt_workflows;
  "node/audioStudies/actions": typeof node_audioStudies_actions;
  "notifications/mutations": typeof notifications_mutations;
  "notifications/queries": typeof notifications_queries;
  "schools/mutations": typeof schools_mutations;
  "schools/queries": typeof schools_queries;
  "subjectSections/queries": typeof subjectSections_queries;
  "subscriptions/mutations": typeof subscriptions_mutations;
  "subscriptions/queries": typeof subscriptions_queries;
  "triggers/chats/cleanup": typeof triggers_chats_cleanup;
  "triggers/comments/cleanup": typeof triggers_comments_cleanup;
  "triggers/materials/cleanup": typeof triggers_materials_cleanup;
  "triggers/schools/cleanup": typeof triggers_schools_cleanup;
  "tryoutAccess/mutations/internalFunctions/competition": typeof tryoutAccess_mutations_internalFunctions_competition;
  "tryoutAccess/mutations/internalFunctions/status": typeof tryoutAccess_mutations_internalFunctions_status;
  "tryoutAccess/mutations/redeem": typeof tryoutAccess_mutations_redeem;
  "tryoutAccess/mutations/setup": typeof tryoutAccess_mutations_setup;
  "tryoutAccess/queries/internalFunctions/maintenance": typeof tryoutAccess_queries_internalFunctions_maintenance;
  "tryoutAccess/queries/page": typeof tryoutAccess_queries_page;
  "tryouts/mutations/attempts": typeof tryouts_mutations_attempts;
  "tryouts/mutations/internalFunctions/expiry": typeof tryouts_mutations_internalFunctions_expiry;
  "tryouts/mutations/internalFunctions/leaderboard": typeof tryouts_mutations_internalFunctions_leaderboard;
  "tryouts/mutations/internalFunctions/scoring": typeof tryouts_mutations_internalFunctions_scoring;
  "tryouts/mutations/internalFunctions/stats": typeof tryouts_mutations_internalFunctions_stats;
  "tryouts/queries/leaderboard": typeof tryouts_queries_leaderboard;
  "tryouts/queries/me/attempt": typeof tryouts_queries_me_attempt;
  "tryouts/queries/me/history": typeof tryouts_queries_me_history;
  "tryouts/queries/me/part": typeof tryouts_queries_me_part;
  "tryouts/queries/me/session": typeof tryouts_queries_me_session;
  "tryouts/queries/me/setView": typeof tryouts_queries_me_setView;
  "tryouts/queries/tryouts": typeof tryouts_queries_tryouts;
  "users/mutations": typeof users_mutations;
  "users/queries": typeof users_queries;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
  irtCalibrationSyncWorkpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"irtCalibrationSyncWorkpool">;
  irtScalePublicationQueueWorkpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"irtScalePublicationQueueWorkpool">;
  tryoutLeaderboardWorkpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"tryoutLeaderboardWorkpool">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
  posthog: import("@posthog/convex/_generated/component.js").ComponentApi<"posthog">;
  tryoutLeaderboard: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"tryoutLeaderboard">;
  globalLeaderboard: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"globalLeaderboard">;
  forumPostsBySequence: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"forumPostsBySequence">;
  forumPostsByAuthorSequence: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"forumPostsByAuthorSequence">;
};
