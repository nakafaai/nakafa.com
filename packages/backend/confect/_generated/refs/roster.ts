import { GroupSpec, Refs, Spec } from "@confect/core";
import roster_entries from "../../roster/entries.spec";

const spec: Spec.Spec<{
  readonly roster: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "roster", never, GroupSpec.NamedAt<typeof roster_entries, "entries">>, "roster">;
}> = Spec.fromGroups({ ["roster"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["entries"]: roster_entries }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.roster;
