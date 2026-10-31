import { GroupSpec, Refs, Spec } from "@confect/core";
import analytics_capture from "../../analytics/capture.spec";
import analytics_erasure_action from "../../analytics/erasure/action.spec";
import analytics_erasure_workflow from "../../analytics/erasure/workflow.spec";

const spec: Spec.Spec<{
  readonly analytics: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "analytics", never, GroupSpec.NamedAt<typeof analytics_capture, "capture"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "erasure", never, GroupSpec.NamedAt<typeof analytics_erasure_action, "action"> | GroupSpec.NamedAt<typeof analytics_erasure_workflow, "workflow">>, "erasure">>, "analytics">;
}> = Spec.fromGroups({ ["analytics"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["capture"]: analytics_capture, ["erasure"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["action"]: analytics_erasure_action, ["workflow"]: analytics_erasure_workflow }) }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.analytics;
