import { GroupSpec, Refs, Spec } from "@confect/core";
import consents_current from "../../consents/current.spec";

const spec: Spec.Spec<{
  readonly consents: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "consents", never, GroupSpec.NamedAt<typeof consents_current, "current">>, "consents">;
}> = Spec.fromGroups({ ["consents"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["current"]: consents_current }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.consents;
