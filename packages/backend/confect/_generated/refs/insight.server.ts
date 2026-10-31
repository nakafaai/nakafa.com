import { GroupSpec, Refs, Spec } from "@confect/core";
import insight_observe from "../../insight/observe.spec";

const spec: Spec.Spec<{
  readonly insight: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "insight", never, GroupSpec.NamedAt<typeof insight_observe, "observe">>, "insight">;
}> = Spec.fromGroups({ ["insight"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["observe"]: insight_observe }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.insight;
