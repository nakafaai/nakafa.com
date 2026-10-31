import { GroupSpec, Refs, Spec } from "@confect/core";
import privacy_recovery from "../../privacy/recovery.spec";

const spec: Spec.Spec<{
  readonly privacy: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "privacy", never, GroupSpec.NamedAt<typeof privacy_recovery, "recovery">>, "privacy">;
}> = Spec.fromGroups({ ["privacy"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["recovery"]: privacy_recovery }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.privacy;
