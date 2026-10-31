import { GroupSpec, Refs, Spec } from "@confect/core";
import insight_narratives from "../../insight/narratives.spec";
import insight_reads from "../../insight/reads.spec";
import insight_tags from "../../insight/tags.spec";

const spec: Spec.Spec<{
  readonly insight: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "insight", never, GroupSpec.NamedAt<typeof insight_narratives, "narratives"> | GroupSpec.NamedAt<typeof insight_reads, "reads"> | GroupSpec.NamedAt<typeof insight_tags, "tags">>, "insight">;
}> = Spec.fromGroups({ ["insight"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["narratives"]: insight_narratives, ["reads"]: insight_reads, ["tags"]: insight_tags }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.insight;
