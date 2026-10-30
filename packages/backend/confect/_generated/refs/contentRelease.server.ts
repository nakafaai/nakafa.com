import { GroupSpec, Refs, Spec } from "@confect/core";
import contentRelease_accept from "../../contentRelease/accept.spec";
import contentRelease_activate from "../../contentRelease/activate.spec";
import contentRelease_article_internal from "../../contentRelease/article/internal.spec";
import contentRelease_artifacts from "../../contentRelease/artifacts.spec";
import contentRelease_cleanup from "../../contentRelease/cleanup.spec";
import contentRelease_compact from "../../contentRelease/compact.spec";
import contentRelease_envelope from "../../contentRelease/envelope.spec";
import contentRelease_heads from "../../contentRelease/heads.spec";
import contentRelease_ingress_dispatch from "../../contentRelease/ingress/dispatch.spec";
import contentRelease_items from "../../contentRelease/items.spec";
import contentRelease_manifest from "../../contentRelease/manifest.spec";
import contentRelease_models from "../../contentRelease/models.spec";
import contentRelease_proof_catalog from "../../contentRelease/proof/catalog.spec";
import contentRelease_proof_commit from "../../contentRelease/proof/commit.spec";
import contentRelease_proof_poll from "../../contentRelease/proof/poll.spec";
import contentRelease_proof_read from "../../contentRelease/proof/read.spec";
import contentRelease_proof_routes from "../../contentRelease/proof/routes.spec";
import contentRelease_proof_verify from "../../contentRelease/proof/verify.spec";
import contentRelease_proof_workflow from "../../contentRelease/proof/workflow.spec";
import contentRelease_recovery from "../../contentRelease/recovery.spec";
import contentRelease_reference_internal from "../../contentRelease/reference/internal.spec";
import contentRelease_rollback from "../../contentRelease/rollback.spec";
import contentRelease_routes from "../../contentRelease/routes.spec";
import contentRelease_runtime_publication_internal from "../../contentRelease/runtime/publication/internal.spec";
import contentRelease_runtime_tryout_dispatch from "../../contentRelease/runtime/tryout/dispatch.spec";
import contentRelease_runtime_tryout_internal from "../../contentRelease/runtime/tryout/internal.spec";
import contentRelease_snapshot_batch from "../../contentRelease/snapshot/batch.spec";
import contentRelease_snapshot_manifest from "../../contentRelease/snapshot/manifest.spec";
import contentRelease_snapshot_read from "../../contentRelease/snapshot/read.spec";
import contentRelease_status from "../../contentRelease/status.spec";
import contentRelease_verify from "../../contentRelease/verify.spec";

const spec: Spec.Spec<{
  readonly contentRelease: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "contentRelease", never, GroupSpec.NamedAt<typeof contentRelease_accept, "accept"> | GroupSpec.NamedAt<typeof contentRelease_activate, "activate"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "article", never, GroupSpec.NamedAt<typeof contentRelease_article_internal, "internal">>, "article"> | GroupSpec.NamedAt<typeof contentRelease_artifacts, "artifacts"> | GroupSpec.NamedAt<typeof contentRelease_cleanup, "cleanup"> | GroupSpec.NamedAt<typeof contentRelease_compact, "compact"> | GroupSpec.NamedAt<typeof contentRelease_envelope, "envelope"> | GroupSpec.NamedAt<typeof contentRelease_heads, "heads"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "ingress", never, GroupSpec.NamedAt<typeof contentRelease_ingress_dispatch, "dispatch">>, "ingress"> | GroupSpec.NamedAt<typeof contentRelease_items, "items"> | GroupSpec.NamedAt<typeof contentRelease_manifest, "manifest"> | GroupSpec.NamedAt<typeof contentRelease_models, "models"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "proof", never, GroupSpec.NamedAt<typeof contentRelease_proof_catalog, "catalog"> | GroupSpec.NamedAt<typeof contentRelease_proof_commit, "commit"> | GroupSpec.NamedAt<typeof contentRelease_proof_poll, "poll"> | GroupSpec.NamedAt<typeof contentRelease_proof_read, "read"> | GroupSpec.NamedAt<typeof contentRelease_proof_routes, "routes"> | GroupSpec.NamedAt<typeof contentRelease_proof_verify, "verify"> | GroupSpec.NamedAt<typeof contentRelease_proof_workflow, "workflow">>, "proof"> | GroupSpec.NamedAt<typeof contentRelease_recovery, "recovery"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "reference", never, GroupSpec.NamedAt<typeof contentRelease_reference_internal, "internal">>, "reference"> | GroupSpec.NamedAt<typeof contentRelease_rollback, "rollback"> | GroupSpec.NamedAt<typeof contentRelease_routes, "routes"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "runtime", never, GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "publication", never, GroupSpec.NamedAt<typeof contentRelease_runtime_publication_internal, "internal">>, "publication"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "tryout", never, GroupSpec.NamedAt<typeof contentRelease_runtime_tryout_dispatch, "dispatch"> | GroupSpec.NamedAt<typeof contentRelease_runtime_tryout_internal, "internal">>, "tryout">>, "runtime"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "snapshot", never, GroupSpec.NamedAt<typeof contentRelease_snapshot_batch, "batch"> | GroupSpec.NamedAt<typeof contentRelease_snapshot_manifest, "manifest"> | GroupSpec.NamedAt<typeof contentRelease_snapshot_read, "read">>, "snapshot"> | GroupSpec.NamedAt<typeof contentRelease_status, "status"> | GroupSpec.NamedAt<typeof contentRelease_verify, "verify">>, "contentRelease">;
}> = Spec.fromGroups({ ["contentRelease"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["accept"]: contentRelease_accept, ["activate"]: contentRelease_activate, ["article"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["internal"]: contentRelease_article_internal }), ["artifacts"]: contentRelease_artifacts, ["cleanup"]: contentRelease_cleanup, ["compact"]: contentRelease_compact, ["envelope"]: contentRelease_envelope, ["heads"]: contentRelease_heads, ["ingress"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["dispatch"]: contentRelease_ingress_dispatch }), ["items"]: contentRelease_items, ["manifest"]: contentRelease_manifest, ["models"]: contentRelease_models, ["proof"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["catalog"]: contentRelease_proof_catalog, ["commit"]: contentRelease_proof_commit, ["poll"]: contentRelease_proof_poll, ["read"]: contentRelease_proof_read, ["routes"]: contentRelease_proof_routes, ["verify"]: contentRelease_proof_verify, ["workflow"]: contentRelease_proof_workflow }), ["recovery"]: contentRelease_recovery, ["reference"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["internal"]: contentRelease_reference_internal }), ["rollback"]: contentRelease_rollback, ["routes"]: contentRelease_routes, ["runtime"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["publication"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["internal"]: contentRelease_runtime_publication_internal }), ["tryout"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["dispatch"]: contentRelease_runtime_tryout_dispatch, ["internal"]: contentRelease_runtime_tryout_internal }) }), ["snapshot"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["batch"]: contentRelease_snapshot_batch, ["manifest"]: contentRelease_snapshot_manifest, ["read"]: contentRelease_snapshot_read }), ["status"]: contentRelease_status, ["verify"]: contentRelease_verify }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.contentRelease;
