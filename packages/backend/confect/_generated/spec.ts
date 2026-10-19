import { GroupSpec, Spec } from "@confect/core";
import access_grants from "../access/grants.spec";
import analytics_capture from "../analytics/capture.spec";
import analytics_erasure_action from "../analytics/erasure/action.spec";
import analytics_erasure_workflow from "../analytics/erasure/workflow.spec";
import auth_actions from "../auth/actions.spec";
import auth_cleanup from "../auth/cleanup.spec";
import auth_deletion from "../auth/deletion.spec";
import auth_deletion_recovery from "../auth/deletion/recovery.spec";
import auth_deletion_verification from "../auth/deletion/verification.spec";
import auth_lifecycle from "../auth/lifecycle.spec";
import auth_queries from "../auth/queries.spec";
import chats_mutations from "../chats/mutations.spec";
import chats_queries from "../chats/queries.spec";
import classroom_classes from "../classroom/classes.spec";
import classroom_forum_backfill from "../classroom/forum/backfill.spec";
import classroom_forum_channels from "../classroom/forum/channels.spec";
import classroom_seed from "../classroom/seed.spec";
import classroom_teachers from "../classroom/teachers.spec";
import comments_migration from "../comments/migration.spec";
import comments_mutations from "../comments/mutations.spec";
import comments_queries from "../comments/queries.spec";
import connectors_connections from "../connectors/connections.spec";
import consents_current from "../consents/current.spec";
import contentRelease_accept from "../contentRelease/accept.spec";
import contentRelease_activate from "../contentRelease/activate.spec";
import contentRelease_article from "../contentRelease/article.spec";
import contentRelease_article_internal from "../contentRelease/article/internal.spec";
import contentRelease_artifacts from "../contentRelease/artifacts.spec";
import contentRelease_cleanup from "../contentRelease/cleanup.spec";
import contentRelease_compact from "../contentRelease/compact.spec";
import contentRelease_envelope from "../contentRelease/envelope.spec";
import contentRelease_heads from "../contentRelease/heads.spec";
import contentRelease_ingress_dispatch from "../contentRelease/ingress/dispatch.spec";
import contentRelease_items from "../contentRelease/items.spec";
import contentRelease_manifest from "../contentRelease/manifest.spec";
import contentRelease_material from "../contentRelease/material.spec";
import contentRelease_models from "../contentRelease/models.spec";
import contentRelease_ownership from "../contentRelease/ownership.spec";
import contentRelease_page from "../contentRelease/page.spec";
import contentRelease_program from "../contentRelease/program.spec";
import contentRelease_proof_catalog from "../contentRelease/proof/catalog.spec";
import contentRelease_proof_commit from "../contentRelease/proof/commit.spec";
import contentRelease_proof_poll from "../contentRelease/proof/poll.spec";
import contentRelease_proof_read from "../contentRelease/proof/read.spec";
import contentRelease_proof_routes from "../contentRelease/proof/routes.spec";
import contentRelease_proof_verify from "../contentRelease/proof/verify.spec";
import contentRelease_proof_workflow from "../contentRelease/proof/workflow.spec";
import contentRelease_quran from "../contentRelease/quran.spec";
import contentRelease_recovery from "../contentRelease/recovery.spec";
import contentRelease_reference from "../contentRelease/reference.spec";
import contentRelease_reference_internal from "../contentRelease/reference/internal.spec";
import contentRelease_rollback from "../contentRelease/rollback.spec";
import contentRelease_routes from "../contentRelease/routes.spec";
import contentRelease_runtime_active from "../contentRelease/runtime/active.spec";
import contentRelease_runtime_publication_internal from "../contentRelease/runtime/publication/internal.spec";
import contentRelease_runtime_tryout_dispatch from "../contentRelease/runtime/tryout/dispatch.spec";
import contentRelease_runtime_tryout_internal from "../contentRelease/runtime/tryout/internal.spec";
import contentRelease_snapshot_batch from "../contentRelease/snapshot/batch.spec";
import contentRelease_snapshot_manifest from "../contentRelease/snapshot/manifest.spec";
import contentRelease_snapshot_read from "../contentRelease/snapshot/read.spec";
import contentRelease_status from "../contentRelease/status.spec";
import contentRelease_tryout from "../contentRelease/tryout.spec";
import contentRelease_verify from "../contentRelease/verify.spec";
import contents_mutations_analytics from "../contents/mutations/analytics.spec";
import contents_mutations_popularity from "../contents/mutations/popularity.spec";
import contents_mutations_views from "../contents/mutations/views.spec";
import contents_queries_recent from "../contents/queries/recent.spec";
import contents_queries_search from "../contents/queries/search.spec";
import contents_queries_trending from "../contents/queries/trending.spec";
import contents_sections_build from "../contents/sections/build.spec";
import contents_sections_compare from "../contents/sections/compare.spec";
import contents_sections_hits from "../contents/sections/hits.spec";
import contents_sections_rows from "../contents/sections/rows.spec";
import contents_sections_search from "../contents/sections/search.spec";
import contents_sections_state from "../contents/sections/state.spec";
import credits_mutations from "../credits/mutations.spec";
import customers_actions_internal from "../customers/actions/internal.spec";
import customers_actions_sessions from "../customers/actions/sessions.spec";
import customers_checkout_admission from "../customers/checkout/admission.spec";
import customers_deletion_cleanup from "../customers/deletion/cleanup.spec";
import customers_deletion_workflow from "../customers/deletion/workflow.spec";
import customers_integrity_internal from "../customers/integrity/internal.spec";
import customers_mutations_internal from "../customers/mutations/internal.spec";
import customers_queries_internal_customer from "../customers/queries/internal/customer.spec";
import editor_deletion from "../editor/deletion.spec";
import editor_documents from "../editor/documents.spec";
import editor_fold from "../editor/fold.spec";
import editor_prune from "../editor/prune.spec";
import editor_steps from "../editor/steps.spec";
import emails_invite_delivery from "../emails/invite/delivery.spec";
import emails_invite_internal from "../emails/invite/internal.spec";
import emails_invite_workflow from "../emails/invite/workflow.spec";
import emails_retention from "../emails/retention.spec";
import emails_welcome_delivery from "../emails/welcome/delivery.spec";
import emails_welcome_internal from "../emails/welcome/internal.spec";
import emails_welcome_reconciliation from "../emails/welcome/reconciliation.spec";
import emails_welcome_workflow from "../emails/welcome/workflow.spec";
import exams_exams from "../exams/exams.spec";
import exams_questions from "../exams/questions.spec";
import exams_seed from "../exams/seed.spec";
import exams_sittings from "../exams/sittings.spec";
import exams_sittings_timers from "../exams/sittings/timers.spec";
import identity_cards from "../identity/cards.spec";
import identity_logins from "../identity/logins.spec";
import integrations_clients from "../integrations/clients.spec";
import journal_audit from "../journal/audit.spec";
import learningPreferences_mutations from "../learningPreferences/mutations.spec";
import learningPreferences_queries from "../learningPreferences/queries.spec";
import nina_brief from "../nina/brief.spec";
import nina_conversation from "../nina/conversation.spec";
import nina_documents from "../nina/documents.spec";
import nina_focus from "../nina/focus.spec";
import nina_judgment from "../nina/judgment.spec";
import nina_lifecycle from "../nina/lifecycle.spec";
import nina_memory from "../nina/memory.spec";
import nina_messages from "../nina/messages.spec";
import nina_phase from "../nina/phase.spec";
import nina_portrait from "../nina/portrait.spec";
import nina_portrait_build from "../nina/portrait/build.spec";
import nina_presentation from "../nina/presentation.spec";
import nina_response from "../nina/response.spec";
import nina_sealed from "../nina/sealed.spec";
import nina_summaries from "../nina/summaries.spec";
import nina_turns from "../nina/turns.spec";
import nina_uploads from "../nina/uploads.spec";
import nina_usage from "../nina/usage.spec";
import nina_waits from "../nina/waits.spec";
import notifications_consume from "../notifications/consume.spec";
import notifications_inbox from "../notifications/inbox.spec";
import notifications_purge from "../notifications/purge.spec";
import notifications_read from "../notifications/read.spec";
import onboarding_mutations from "../onboarding/mutations.spec";
import onboarding_queries from "../onboarding/queries.spec";
import operators_expiry from "../operators/expiry.spec";
import operators_staff from "../operators/staff.spec";
import operators_tenants from "../operators/tenants.spec";
import operators_visits from "../operators/visits.spec";
import posts_cleanup from "../posts/cleanup.spec";
import posts_mutations from "../posts/mutations.spec";
import posts_queries from "../posts/queries.spec";
import privacy_recovery from "../privacy/recovery.spec";
import records_grades from "../records/grades.spec";
import records_schemes from "../records/schemes.spec";
import routes_agent_quota from "../routes/agent/quota.spec";
import storage from "../storage.spec";
import subscriptions_mutations from "../subscriptions/mutations.spec";
import subscriptions_queries from "../subscriptions/queries.spec";
import tenancy_assignments from "../tenancy/assignments.spec";
import tenancy_claims from "../tenancy/claims.spec";
import tenancy_cohorts from "../tenancy/cohorts.spec";
import tenancy_expiry from "../tenancy/expiry.spec";
import tenancy_holders from "../tenancy/holders.spec";
import tenancy_invites from "../tenancy/invites.spec";
import tenancy_logo from "../tenancy/logo.spec";
import tenancy_memberships from "../tenancy/memberships.spec";
import tenancy_people from "../tenancy/people.spec";
import tenancy_periods from "../tenancy/periods.spec";
import tenancy_placements from "../tenancy/placements.spec";
import tenancy_profile from "../tenancy/profile.spec";
import tenancy_promotion_apply from "../tenancy/promotion/apply.spec";
import tenancy_promotion_draft from "../tenancy/promotion/draft.spec";
import tenancy_promotion_moves from "../tenancy/promotion/moves.spec";
import tenancy_promotion_review from "../tenancy/promotion/review.spec";
import tenancy_promotion_run from "../tenancy/promotion/run.spec";
import tenancy_promotion_undo from "../tenancy/promotion/undo.spec";
import tenancy_provision from "../tenancy/provision.spec";
import tenancy_seed from "../tenancy/seed.spec";
import tenancy_settings from "../tenancy/settings.spec";
import tenancy_units from "../tenancy/units.spec";
import tenancy_viewer from "../tenancy/viewer.spec";
import triggers_chats_cleanup from "../triggers/chats/cleanup.spec";
import triggers_comments_cleanup from "../triggers/comments/cleanup.spec";
import tryouts_mutations_access from "../tryouts/mutations/access.spec";
import tryouts_mutations_attempts from "../tryouts/mutations/attempts.spec";
import tryouts_mutations_expiry from "../tryouts/mutations/expiry.spec";
import tryouts_mutations_responses from "../tryouts/mutations/responses.spec";
import tryouts_mutations_sections from "../tryouts/mutations/sections.spec";
import tryouts_queries_access from "../tryouts/queries/access.spec";
import tryouts_queries_attempt from "../tryouts/queries/attempt.spec";
import tryouts_queries_attemptPage from "../tryouts/queries/attemptPage.spec";
import tryouts_queries_catalog from "../tryouts/queries/catalog.spec";
import tryouts_queries_content from "../tryouts/queries/content.spec";
import tryouts_queries_history from "../tryouts/queries/history.spec";
import tryouts_queries_runtime from "../tryouts/queries/runtime.spec";
import tryouts_queries_sets from "../tryouts/queries/sets.spec";
import tryouts_runtime_signed from "../tryouts/runtime/signed.spec";
import users_mutations from "../users/mutations.spec";
import users_queries from "../users/queries.spec";
import vault_keys from "../vault/keys.spec";

const spec: Spec.Spec<{
  readonly access: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "access", never, GroupSpec.NamedAt<typeof access_grants, "grants">>, "access">;
  readonly analytics: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "analytics", never, GroupSpec.NamedAt<typeof analytics_capture, "capture"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "erasure", never, GroupSpec.NamedAt<typeof analytics_erasure_action, "action"> | GroupSpec.NamedAt<typeof analytics_erasure_workflow, "workflow">>, "erasure">>, "analytics">;
  readonly auth: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "auth", never, GroupSpec.NamedAt<typeof auth_actions, "actions"> | GroupSpec.NamedAt<typeof auth_cleanup, "cleanup"> | GroupSpec.NamedAt<GroupSpec.AddGroups<typeof auth_deletion, GroupSpec.NamedAt<typeof auth_deletion_recovery, "recovery"> | GroupSpec.NamedAt<typeof auth_deletion_verification, "verification">>, "deletion"> | GroupSpec.NamedAt<typeof auth_lifecycle, "lifecycle"> | GroupSpec.NamedAt<typeof auth_queries, "queries">>, "auth">;
  readonly chats: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "chats", never, GroupSpec.NamedAt<typeof chats_mutations, "mutations"> | GroupSpec.NamedAt<typeof chats_queries, "queries">>, "chats">;
  readonly classroom: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "classroom", never, GroupSpec.NamedAt<typeof classroom_classes, "classes"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "forum", never, GroupSpec.NamedAt<typeof classroom_forum_backfill, "backfill"> | GroupSpec.NamedAt<typeof classroom_forum_channels, "channels">>, "forum"> | GroupSpec.NamedAt<typeof classroom_seed, "seed"> | GroupSpec.NamedAt<typeof classroom_teachers, "teachers">>, "classroom">;
  readonly comments: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "comments", never, GroupSpec.NamedAt<typeof comments_migration, "migration"> | GroupSpec.NamedAt<typeof comments_mutations, "mutations"> | GroupSpec.NamedAt<typeof comments_queries, "queries">>, "comments">;
  readonly connectors: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "connectors", never, GroupSpec.NamedAt<typeof connectors_connections, "connections">>, "connectors">;
  readonly consents: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "consents", never, GroupSpec.NamedAt<typeof consents_current, "current">>, "consents">;
  readonly contentRelease: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "contentRelease", never, GroupSpec.NamedAt<typeof contentRelease_accept, "accept"> | GroupSpec.NamedAt<typeof contentRelease_activate, "activate"> | GroupSpec.NamedAt<GroupSpec.AddGroups<typeof contentRelease_article, GroupSpec.NamedAt<typeof contentRelease_article_internal, "internal">>, "article"> | GroupSpec.NamedAt<typeof contentRelease_artifacts, "artifacts"> | GroupSpec.NamedAt<typeof contentRelease_cleanup, "cleanup"> | GroupSpec.NamedAt<typeof contentRelease_compact, "compact"> | GroupSpec.NamedAt<typeof contentRelease_envelope, "envelope"> | GroupSpec.NamedAt<typeof contentRelease_heads, "heads"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "ingress", never, GroupSpec.NamedAt<typeof contentRelease_ingress_dispatch, "dispatch">>, "ingress"> | GroupSpec.NamedAt<typeof contentRelease_items, "items"> | GroupSpec.NamedAt<typeof contentRelease_manifest, "manifest"> | GroupSpec.NamedAt<typeof contentRelease_material, "material"> | GroupSpec.NamedAt<typeof contentRelease_models, "models"> | GroupSpec.NamedAt<typeof contentRelease_ownership, "ownership"> | GroupSpec.NamedAt<typeof contentRelease_page, "page"> | GroupSpec.NamedAt<typeof contentRelease_program, "program"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "proof", never, GroupSpec.NamedAt<typeof contentRelease_proof_catalog, "catalog"> | GroupSpec.NamedAt<typeof contentRelease_proof_commit, "commit"> | GroupSpec.NamedAt<typeof contentRelease_proof_poll, "poll"> | GroupSpec.NamedAt<typeof contentRelease_proof_read, "read"> | GroupSpec.NamedAt<typeof contentRelease_proof_routes, "routes"> | GroupSpec.NamedAt<typeof contentRelease_proof_verify, "verify"> | GroupSpec.NamedAt<typeof contentRelease_proof_workflow, "workflow">>, "proof"> | GroupSpec.NamedAt<typeof contentRelease_quran, "quran"> | GroupSpec.NamedAt<typeof contentRelease_recovery, "recovery"> | GroupSpec.NamedAt<GroupSpec.AddGroups<typeof contentRelease_reference, GroupSpec.NamedAt<typeof contentRelease_reference_internal, "internal">>, "reference"> | GroupSpec.NamedAt<typeof contentRelease_rollback, "rollback"> | GroupSpec.NamedAt<typeof contentRelease_routes, "routes"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "runtime", never, GroupSpec.NamedAt<typeof contentRelease_runtime_active, "active"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "publication", never, GroupSpec.NamedAt<typeof contentRelease_runtime_publication_internal, "internal">>, "publication"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "tryout", never, GroupSpec.NamedAt<typeof contentRelease_runtime_tryout_dispatch, "dispatch"> | GroupSpec.NamedAt<typeof contentRelease_runtime_tryout_internal, "internal">>, "tryout">>, "runtime"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "snapshot", never, GroupSpec.NamedAt<typeof contentRelease_snapshot_batch, "batch"> | GroupSpec.NamedAt<typeof contentRelease_snapshot_manifest, "manifest"> | GroupSpec.NamedAt<typeof contentRelease_snapshot_read, "read">>, "snapshot"> | GroupSpec.NamedAt<typeof contentRelease_status, "status"> | GroupSpec.NamedAt<typeof contentRelease_tryout, "tryout"> | GroupSpec.NamedAt<typeof contentRelease_verify, "verify">>, "contentRelease">;
  readonly contents: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "contents", never, GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "mutations", never, GroupSpec.NamedAt<typeof contents_mutations_analytics, "analytics"> | GroupSpec.NamedAt<typeof contents_mutations_popularity, "popularity"> | GroupSpec.NamedAt<typeof contents_mutations_views, "views">>, "mutations"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "queries", never, GroupSpec.NamedAt<typeof contents_queries_recent, "recent"> | GroupSpec.NamedAt<typeof contents_queries_search, "search"> | GroupSpec.NamedAt<typeof contents_queries_trending, "trending">>, "queries"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "sections", never, GroupSpec.NamedAt<typeof contents_sections_build, "build"> | GroupSpec.NamedAt<typeof contents_sections_compare, "compare"> | GroupSpec.NamedAt<typeof contents_sections_hits, "hits"> | GroupSpec.NamedAt<typeof contents_sections_rows, "rows"> | GroupSpec.NamedAt<typeof contents_sections_search, "search"> | GroupSpec.NamedAt<typeof contents_sections_state, "state">>, "sections">>, "contents">;
  readonly credits: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "credits", never, GroupSpec.NamedAt<typeof credits_mutations, "mutations">>, "credits">;
  readonly customers: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "customers", never, GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "actions", never, GroupSpec.NamedAt<typeof customers_actions_internal, "internal"> | GroupSpec.NamedAt<typeof customers_actions_sessions, "sessions">>, "actions"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "checkout", never, GroupSpec.NamedAt<typeof customers_checkout_admission, "admission">>, "checkout"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "deletion", never, GroupSpec.NamedAt<typeof customers_deletion_cleanup, "cleanup"> | GroupSpec.NamedAt<typeof customers_deletion_workflow, "workflow">>, "deletion"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "integrity", never, GroupSpec.NamedAt<typeof customers_integrity_internal, "internal">>, "integrity"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "mutations", never, GroupSpec.NamedAt<typeof customers_mutations_internal, "internal">>, "mutations"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "queries", never, GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "internal", never, GroupSpec.NamedAt<typeof customers_queries_internal_customer, "customer">>, "internal">>, "queries">>, "customers">;
  readonly editor: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "editor", never, GroupSpec.NamedAt<typeof editor_deletion, "deletion"> | GroupSpec.NamedAt<typeof editor_documents, "documents"> | GroupSpec.NamedAt<typeof editor_fold, "fold"> | GroupSpec.NamedAt<typeof editor_prune, "prune"> | GroupSpec.NamedAt<typeof editor_steps, "steps">>, "editor">;
  readonly emails: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "emails", never, GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "invite", never, GroupSpec.NamedAt<typeof emails_invite_delivery, "delivery"> | GroupSpec.NamedAt<typeof emails_invite_internal, "internal"> | GroupSpec.NamedAt<typeof emails_invite_workflow, "workflow">>, "invite"> | GroupSpec.NamedAt<typeof emails_retention, "retention"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "welcome", never, GroupSpec.NamedAt<typeof emails_welcome_delivery, "delivery"> | GroupSpec.NamedAt<typeof emails_welcome_internal, "internal"> | GroupSpec.NamedAt<typeof emails_welcome_reconciliation, "reconciliation"> | GroupSpec.NamedAt<typeof emails_welcome_workflow, "workflow">>, "welcome">>, "emails">;
  readonly exams: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "exams", never, GroupSpec.NamedAt<typeof exams_exams, "exams"> | GroupSpec.NamedAt<typeof exams_questions, "questions"> | GroupSpec.NamedAt<typeof exams_seed, "seed"> | GroupSpec.NamedAt<GroupSpec.AddGroups<typeof exams_sittings, GroupSpec.NamedAt<typeof exams_sittings_timers, "timers">>, "sittings">>, "exams">;
  readonly identity: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "identity", never, GroupSpec.NamedAt<typeof identity_cards, "cards"> | GroupSpec.NamedAt<typeof identity_logins, "logins">>, "identity">;
  readonly integrations: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "integrations", never, GroupSpec.NamedAt<typeof integrations_clients, "clients">>, "integrations">;
  readonly journal: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "journal", never, GroupSpec.NamedAt<typeof journal_audit, "audit">>, "journal">;
  readonly learningPreferences: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "learningPreferences", never, GroupSpec.NamedAt<typeof learningPreferences_mutations, "mutations"> | GroupSpec.NamedAt<typeof learningPreferences_queries, "queries">>, "learningPreferences">;
  readonly nina: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "nina", never, GroupSpec.NamedAt<typeof nina_brief, "brief"> | GroupSpec.NamedAt<typeof nina_conversation, "conversation"> | GroupSpec.NamedAt<typeof nina_documents, "documents"> | GroupSpec.NamedAt<typeof nina_focus, "focus"> | GroupSpec.NamedAt<typeof nina_judgment, "judgment"> | GroupSpec.NamedAt<typeof nina_lifecycle, "lifecycle"> | GroupSpec.NamedAt<typeof nina_memory, "memory"> | GroupSpec.NamedAt<typeof nina_messages, "messages"> | GroupSpec.NamedAt<typeof nina_phase, "phase"> | GroupSpec.NamedAt<GroupSpec.AddGroups<typeof nina_portrait, GroupSpec.NamedAt<typeof nina_portrait_build, "build">>, "portrait"> | GroupSpec.NamedAt<typeof nina_presentation, "presentation"> | GroupSpec.NamedAt<typeof nina_response, "response"> | GroupSpec.NamedAt<typeof nina_sealed, "sealed"> | GroupSpec.NamedAt<typeof nina_summaries, "summaries"> | GroupSpec.NamedAt<typeof nina_turns, "turns"> | GroupSpec.NamedAt<typeof nina_uploads, "uploads"> | GroupSpec.NamedAt<typeof nina_usage, "usage"> | GroupSpec.NamedAt<typeof nina_waits, "waits">>, "nina">;
  readonly notifications: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "notifications", never, GroupSpec.NamedAt<typeof notifications_consume, "consume"> | GroupSpec.NamedAt<typeof notifications_inbox, "inbox"> | GroupSpec.NamedAt<typeof notifications_purge, "purge"> | GroupSpec.NamedAt<typeof notifications_read, "read">>, "notifications">;
  readonly onboarding: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "onboarding", never, GroupSpec.NamedAt<typeof onboarding_mutations, "mutations"> | GroupSpec.NamedAt<typeof onboarding_queries, "queries">>, "onboarding">;
  readonly operators: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "operators", never, GroupSpec.NamedAt<typeof operators_expiry, "expiry"> | GroupSpec.NamedAt<typeof operators_staff, "staff"> | GroupSpec.NamedAt<typeof operators_tenants, "tenants"> | GroupSpec.NamedAt<typeof operators_visits, "visits">>, "operators">;
  readonly posts: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "posts", never, GroupSpec.NamedAt<typeof posts_cleanup, "cleanup"> | GroupSpec.NamedAt<typeof posts_mutations, "mutations"> | GroupSpec.NamedAt<typeof posts_queries, "queries">>, "posts">;
  readonly privacy: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "privacy", never, GroupSpec.NamedAt<typeof privacy_recovery, "recovery">>, "privacy">;
  readonly records: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "records", never, GroupSpec.NamedAt<typeof records_grades, "grades"> | GroupSpec.NamedAt<typeof records_schemes, "schemes">>, "records">;
  readonly routes: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "routes", never, GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "agent", never, GroupSpec.NamedAt<typeof routes_agent_quota, "quota">>, "agent">>, "routes">;
  readonly storage: GroupSpec.NamedAt<typeof storage, "storage">;
  readonly subscriptions: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "subscriptions", never, GroupSpec.NamedAt<typeof subscriptions_mutations, "mutations"> | GroupSpec.NamedAt<typeof subscriptions_queries, "queries">>, "subscriptions">;
  readonly tenancy: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "tenancy", never, GroupSpec.NamedAt<typeof tenancy_assignments, "assignments"> | GroupSpec.NamedAt<typeof tenancy_claims, "claims"> | GroupSpec.NamedAt<typeof tenancy_cohorts, "cohorts"> | GroupSpec.NamedAt<typeof tenancy_expiry, "expiry"> | GroupSpec.NamedAt<typeof tenancy_holders, "holders"> | GroupSpec.NamedAt<typeof tenancy_invites, "invites"> | GroupSpec.NamedAt<typeof tenancy_logo, "logo"> | GroupSpec.NamedAt<typeof tenancy_memberships, "memberships"> | GroupSpec.NamedAt<typeof tenancy_people, "people"> | GroupSpec.NamedAt<typeof tenancy_periods, "periods"> | GroupSpec.NamedAt<typeof tenancy_placements, "placements"> | GroupSpec.NamedAt<typeof tenancy_profile, "profile"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "promotion", never, GroupSpec.NamedAt<typeof tenancy_promotion_apply, "apply"> | GroupSpec.NamedAt<typeof tenancy_promotion_draft, "draft"> | GroupSpec.NamedAt<typeof tenancy_promotion_moves, "moves"> | GroupSpec.NamedAt<typeof tenancy_promotion_review, "review"> | GroupSpec.NamedAt<typeof tenancy_promotion_run, "run"> | GroupSpec.NamedAt<typeof tenancy_promotion_undo, "undo">>, "promotion"> | GroupSpec.NamedAt<typeof tenancy_provision, "provision"> | GroupSpec.NamedAt<typeof tenancy_seed, "seed"> | GroupSpec.NamedAt<typeof tenancy_settings, "settings"> | GroupSpec.NamedAt<typeof tenancy_units, "units"> | GroupSpec.NamedAt<typeof tenancy_viewer, "viewer">>, "tenancy">;
  readonly triggers: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "triggers", never, GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "chats", never, GroupSpec.NamedAt<typeof triggers_chats_cleanup, "cleanup">>, "chats"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "comments", never, GroupSpec.NamedAt<typeof triggers_comments_cleanup, "cleanup">>, "comments">>, "triggers">;
  readonly tryouts: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "tryouts", never, GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "mutations", never, GroupSpec.NamedAt<typeof tryouts_mutations_access, "access"> | GroupSpec.NamedAt<typeof tryouts_mutations_attempts, "attempts"> | GroupSpec.NamedAt<typeof tryouts_mutations_expiry, "expiry"> | GroupSpec.NamedAt<typeof tryouts_mutations_responses, "responses"> | GroupSpec.NamedAt<typeof tryouts_mutations_sections, "sections">>, "mutations"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "queries", never, GroupSpec.NamedAt<typeof tryouts_queries_access, "access"> | GroupSpec.NamedAt<typeof tryouts_queries_attempt, "attempt"> | GroupSpec.NamedAt<typeof tryouts_queries_attemptPage, "attemptPage"> | GroupSpec.NamedAt<typeof tryouts_queries_catalog, "catalog"> | GroupSpec.NamedAt<typeof tryouts_queries_content, "content"> | GroupSpec.NamedAt<typeof tryouts_queries_history, "history"> | GroupSpec.NamedAt<typeof tryouts_queries_runtime, "runtime"> | GroupSpec.NamedAt<typeof tryouts_queries_sets, "sets">>, "queries"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "runtime", never, GroupSpec.NamedAt<typeof tryouts_runtime_signed, "signed">>, "runtime">>, "tryouts">;
  readonly users: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "users", never, GroupSpec.NamedAt<typeof users_mutations, "mutations"> | GroupSpec.NamedAt<typeof users_queries, "queries">>, "users">;
  readonly vault: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "vault", never, GroupSpec.NamedAt<typeof vault_keys, "keys">>, "vault">;
}> = Spec.fromGroups({
  ["access"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["grants"]: access_grants,
  }),
  ["analytics"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["capture"]: analytics_capture,
    ["erasure"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
      ["action"]: analytics_erasure_action,
      ["workflow"]: analytics_erasure_workflow,
    }),
  }),
  ["auth"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["actions"]: auth_actions,
    ["cleanup"]: auth_cleanup,
    ["deletion"]: GroupSpec.addGroupsAt(auth_deletion, {
      ["recovery"]: auth_deletion_recovery,
      ["verification"]: auth_deletion_verification,
    }),
    ["lifecycle"]: auth_lifecycle,
    ["queries"]: auth_queries,
  }),
  ["chats"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["mutations"]: chats_mutations,
    ["queries"]: chats_queries,
  }),
  ["classroom"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["classes"]: classroom_classes,
    ["forum"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
      ["backfill"]: classroom_forum_backfill,
      ["channels"]: classroom_forum_channels,
    }),
    ["seed"]: classroom_seed,
    ["teachers"]: classroom_teachers,
  }),
  ["comments"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["migration"]: comments_migration,
    ["mutations"]: comments_mutations,
    ["queries"]: comments_queries,
  }),
  ["connectors"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["connections"]: connectors_connections,
  }),
  ["consents"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["current"]: consents_current,
  }),
  ["contentRelease"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["accept"]: contentRelease_accept,
    ["activate"]: contentRelease_activate,
    ["article"]: GroupSpec.addGroupsAt(contentRelease_article, {
      ["internal"]: contentRelease_article_internal,
    }),
    ["artifacts"]: contentRelease_artifacts,
    ["cleanup"]: contentRelease_cleanup,
    ["compact"]: contentRelease_compact,
    ["envelope"]: contentRelease_envelope,
    ["heads"]: contentRelease_heads,
    ["ingress"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
      ["dispatch"]: contentRelease_ingress_dispatch,
    }),
    ["items"]: contentRelease_items,
    ["manifest"]: contentRelease_manifest,
    ["material"]: contentRelease_material,
    ["models"]: contentRelease_models,
    ["ownership"]: contentRelease_ownership,
    ["page"]: contentRelease_page,
    ["program"]: contentRelease_program,
    ["proof"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
      ["catalog"]: contentRelease_proof_catalog,
      ["commit"]: contentRelease_proof_commit,
      ["poll"]: contentRelease_proof_poll,
      ["read"]: contentRelease_proof_read,
      ["routes"]: contentRelease_proof_routes,
      ["verify"]: contentRelease_proof_verify,
      ["workflow"]: contentRelease_proof_workflow,
    }),
    ["quran"]: contentRelease_quran,
    ["recovery"]: contentRelease_recovery,
    ["reference"]: GroupSpec.addGroupsAt(contentRelease_reference, {
      ["internal"]: contentRelease_reference_internal,
    }),
    ["rollback"]: contentRelease_rollback,
    ["routes"]: contentRelease_routes,
    ["runtime"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
      ["active"]: contentRelease_runtime_active,
      ["publication"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
        ["internal"]: contentRelease_runtime_publication_internal,
      }),
      ["tryout"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
        ["dispatch"]: contentRelease_runtime_tryout_dispatch,
        ["internal"]: contentRelease_runtime_tryout_internal,
      }),
    }),
    ["snapshot"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
      ["batch"]: contentRelease_snapshot_batch,
      ["manifest"]: contentRelease_snapshot_manifest,
      ["read"]: contentRelease_snapshot_read,
    }),
    ["status"]: contentRelease_status,
    ["tryout"]: contentRelease_tryout,
    ["verify"]: contentRelease_verify,
  }),
  ["contents"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["mutations"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
      ["analytics"]: contents_mutations_analytics,
      ["popularity"]: contents_mutations_popularity,
      ["views"]: contents_mutations_views,
    }),
    ["queries"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
      ["recent"]: contents_queries_recent,
      ["search"]: contents_queries_search,
      ["trending"]: contents_queries_trending,
    }),
    ["sections"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
      ["build"]: contents_sections_build,
      ["compare"]: contents_sections_compare,
      ["hits"]: contents_sections_hits,
      ["rows"]: contents_sections_rows,
      ["search"]: contents_sections_search,
      ["state"]: contents_sections_state,
    }),
  }),
  ["credits"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["mutations"]: credits_mutations,
  }),
  ["customers"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["actions"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
      ["internal"]: customers_actions_internal,
      ["sessions"]: customers_actions_sessions,
    }),
    ["checkout"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
      ["admission"]: customers_checkout_admission,
    }),
    ["deletion"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
      ["cleanup"]: customers_deletion_cleanup,
      ["workflow"]: customers_deletion_workflow,
    }),
    ["integrity"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
      ["internal"]: customers_integrity_internal,
    }),
    ["mutations"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
      ["internal"]: customers_mutations_internal,
    }),
    ["queries"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
      ["internal"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
        ["customer"]: customers_queries_internal_customer,
      }),
    }),
  }),
  ["editor"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["deletion"]: editor_deletion,
    ["documents"]: editor_documents,
    ["fold"]: editor_fold,
    ["prune"]: editor_prune,
    ["steps"]: editor_steps,
  }),
  ["emails"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["invite"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
      ["delivery"]: emails_invite_delivery,
      ["internal"]: emails_invite_internal,
      ["workflow"]: emails_invite_workflow,
    }),
    ["retention"]: emails_retention,
    ["welcome"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
      ["delivery"]: emails_welcome_delivery,
      ["internal"]: emails_welcome_internal,
      ["reconciliation"]: emails_welcome_reconciliation,
      ["workflow"]: emails_welcome_workflow,
    }),
  }),
  ["exams"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["exams"]: exams_exams,
    ["questions"]: exams_questions,
    ["seed"]: exams_seed,
    ["sittings"]: GroupSpec.addGroupsAt(exams_sittings, {
      ["timers"]: exams_sittings_timers,
    }),
  }),
  ["identity"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["cards"]: identity_cards,
    ["logins"]: identity_logins,
  }),
  ["integrations"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["clients"]: integrations_clients,
  }),
  ["journal"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["audit"]: journal_audit,
  }),
  ["learningPreferences"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["mutations"]: learningPreferences_mutations,
    ["queries"]: learningPreferences_queries,
  }),
  ["nina"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["brief"]: nina_brief,
    ["conversation"]: nina_conversation,
    ["documents"]: nina_documents,
    ["focus"]: nina_focus,
    ["judgment"]: nina_judgment,
    ["lifecycle"]: nina_lifecycle,
    ["memory"]: nina_memory,
    ["messages"]: nina_messages,
    ["phase"]: nina_phase,
    ["portrait"]: GroupSpec.addGroupsAt(nina_portrait, {
      ["build"]: nina_portrait_build,
    }),
    ["presentation"]: nina_presentation,
    ["response"]: nina_response,
    ["sealed"]: nina_sealed,
    ["summaries"]: nina_summaries,
    ["turns"]: nina_turns,
    ["uploads"]: nina_uploads,
    ["usage"]: nina_usage,
    ["waits"]: nina_waits,
  }),
  ["notifications"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["consume"]: notifications_consume,
    ["inbox"]: notifications_inbox,
    ["purge"]: notifications_purge,
    ["read"]: notifications_read,
  }),
  ["onboarding"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["mutations"]: onboarding_mutations,
    ["queries"]: onboarding_queries,
  }),
  ["operators"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["expiry"]: operators_expiry,
    ["staff"]: operators_staff,
    ["tenants"]: operators_tenants,
    ["visits"]: operators_visits,
  }),
  ["posts"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["cleanup"]: posts_cleanup,
    ["mutations"]: posts_mutations,
    ["queries"]: posts_queries,
  }),
  ["privacy"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["recovery"]: privacy_recovery,
  }),
  ["records"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["grades"]: records_grades,
    ["schemes"]: records_schemes,
  }),
  ["routes"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["agent"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
      ["quota"]: routes_agent_quota,
    }),
  }),
  ["storage"]: storage,
  ["subscriptions"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["mutations"]: subscriptions_mutations,
    ["queries"]: subscriptions_queries,
  }),
  ["tenancy"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["assignments"]: tenancy_assignments,
    ["claims"]: tenancy_claims,
    ["cohorts"]: tenancy_cohorts,
    ["expiry"]: tenancy_expiry,
    ["holders"]: tenancy_holders,
    ["invites"]: tenancy_invites,
    ["logo"]: tenancy_logo,
    ["memberships"]: tenancy_memberships,
    ["people"]: tenancy_people,
    ["periods"]: tenancy_periods,
    ["placements"]: tenancy_placements,
    ["profile"]: tenancy_profile,
    ["promotion"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
      ["apply"]: tenancy_promotion_apply,
      ["draft"]: tenancy_promotion_draft,
      ["moves"]: tenancy_promotion_moves,
      ["review"]: tenancy_promotion_review,
      ["run"]: tenancy_promotion_run,
      ["undo"]: tenancy_promotion_undo,
    }),
    ["provision"]: tenancy_provision,
    ["seed"]: tenancy_seed,
    ["settings"]: tenancy_settings,
    ["units"]: tenancy_units,
    ["viewer"]: tenancy_viewer,
  }),
  ["triggers"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["chats"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
      ["cleanup"]: triggers_chats_cleanup,
    }),
    ["comments"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
      ["cleanup"]: triggers_comments_cleanup,
    }),
  }),
  ["tryouts"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["mutations"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
      ["access"]: tryouts_mutations_access,
      ["attempts"]: tryouts_mutations_attempts,
      ["expiry"]: tryouts_mutations_expiry,
      ["responses"]: tryouts_mutations_responses,
      ["sections"]: tryouts_mutations_sections,
    }),
    ["queries"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
      ["access"]: tryouts_queries_access,
      ["attempt"]: tryouts_queries_attempt,
      ["attemptPage"]: tryouts_queries_attemptPage,
      ["catalog"]: tryouts_queries_catalog,
      ["content"]: tryouts_queries_content,
      ["history"]: tryouts_queries_history,
      ["runtime"]: tryouts_queries_runtime,
      ["sets"]: tryouts_queries_sets,
    }),
    ["runtime"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
      ["signed"]: tryouts_runtime_signed,
    }),
  }),
  ["users"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["mutations"]: users_mutations,
    ["queries"]: users_queries,
  }),
  ["vault"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["keys"]: vault_keys,
  }),
}) as typeof spec;

export default spec;
