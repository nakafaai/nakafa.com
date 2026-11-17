import { GroupSpec, Refs, Spec } from "@confect/core";
import auth_account from "../../auth/account.spec";
import auth_caller from "../../auth/caller.spec";
import auth_cleanup from "../../auth/cleanup.spec";
import auth_deletion_cleanup from "../../auth/deletion/cleanup.spec";
import auth_deletion_workflow from "../../auth/deletion/workflow.spec";
import auth_grant from "../../auth/grant.spec";

const spec: Spec.Spec<{
  readonly auth: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "auth", never, GroupSpec.NamedAt<typeof auth_account, "account"> | GroupSpec.NamedAt<typeof auth_caller, "caller"> | GroupSpec.NamedAt<typeof auth_cleanup, "cleanup"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "deletion", never, GroupSpec.NamedAt<typeof auth_deletion_cleanup, "cleanup"> | GroupSpec.NamedAt<typeof auth_deletion_workflow, "workflow">>, "deletion"> | GroupSpec.NamedAt<typeof auth_grant, "grant">>, "auth">;
}> = Spec.fromGroups({ ["auth"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["account"]: auth_account, ["caller"]: auth_caller, ["cleanup"]: auth_cleanup, ["deletion"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["cleanup"]: auth_deletion_cleanup, ["workflow"]: auth_deletion_workflow }), ["grant"]: auth_grant }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.auth;
