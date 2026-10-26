import { GroupSpec, Refs, Spec } from "@confect/core";
import roster_entries from "../../roster/entries.spec";
import roster_exports from "../../roster/exports.spec";
import roster_imports from "../../roster/imports.spec";

const spec: Spec.Spec<{
  readonly roster: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "roster", never, GroupSpec.NamedAt<typeof roster_entries, "entries"> | GroupSpec.NamedAt<typeof roster_exports, "exports"> | GroupSpec.NamedAt<typeof roster_imports, "imports">>, "roster">;
}> = Spec.fromGroups({ ["roster"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["entries"]: roster_entries, ["exports"]: roster_exports, ["imports"]: roster_imports }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.roster;
