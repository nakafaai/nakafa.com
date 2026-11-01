import { GroupSpec, Refs, Spec } from "@confect/core";
import insight_calibration from "../../insight/calibration.spec";
import insight_drafts from "../../insight/drafts.spec";
import insight_observe from "../../insight/observe.spec";
import insight_retention from "../../insight/retention.spec";

const spec: Spec.Spec<{
  readonly insight: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "insight", never, GroupSpec.NamedAt<typeof insight_calibration, "calibration"> | GroupSpec.NamedAt<typeof insight_drafts, "drafts"> | GroupSpec.NamedAt<typeof insight_observe, "observe"> | GroupSpec.NamedAt<typeof insight_retention, "retention">>, "insight">;
}> = Spec.fromGroups({ ["insight"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["calibration"]: insight_calibration, ["drafts"]: insight_drafts, ["observe"]: insight_observe, ["retention"]: insight_retention }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.insight;
