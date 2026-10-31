import { GroupSpec, Refs, Spec } from "@confect/core";
import auth_actions from "../../auth/actions.spec";
import auth_cleanup from "../../auth/cleanup.spec";
import auth_deletion from "../../auth/deletion.spec";
import auth_deletion_cleanup from "../../auth/deletion/cleanup.spec";
import auth_deletion_recovery from "../../auth/deletion/recovery.spec";
import auth_deletion_verification from "../../auth/deletion/verification.spec";
import auth_deletion_workflow from "../../auth/deletion/workflow.spec";
import auth_lifecycle from "../../auth/lifecycle.spec";

const spec: Spec.Spec<{
  readonly auth: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "auth", never, GroupSpec.NamedAt<typeof auth_actions, "actions"> | GroupSpec.NamedAt<typeof auth_cleanup, "cleanup"> | GroupSpec.NamedAt<GroupSpec.AddGroups<typeof auth_deletion, GroupSpec.NamedAt<typeof auth_deletion_cleanup, "cleanup"> | GroupSpec.NamedAt<typeof auth_deletion_recovery, "recovery"> | GroupSpec.NamedAt<typeof auth_deletion_verification, "verification"> | GroupSpec.NamedAt<typeof auth_deletion_workflow, "workflow">>, "deletion"> | GroupSpec.NamedAt<typeof auth_lifecycle, "lifecycle">>, "auth">;
}> = Spec.fromGroups({ ["auth"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["actions"]: auth_actions, ["cleanup"]: auth_cleanup, ["deletion"]: GroupSpec.addGroupsAt(auth_deletion, { ["cleanup"]: auth_deletion_cleanup, ["recovery"]: auth_deletion_recovery, ["verification"]: auth_deletion_verification, ["workflow"]: auth_deletion_workflow }), ["lifecycle"]: auth_lifecycle }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.auth;
