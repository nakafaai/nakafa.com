import { GroupSpec, Refs, Spec } from "@confect/core";
import progress_queries from "../../progress/queries.spec";

const spec: Spec.Spec<{
  readonly progress: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "progress", never, GroupSpec.NamedAt<typeof progress_queries, "queries">>, "progress">;
}> = Spec.fromGroups({ ["progress"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["queries"]: progress_queries }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.progress;
