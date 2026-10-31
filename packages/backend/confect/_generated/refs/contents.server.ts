import { GroupSpec, Refs, Spec } from "@confect/core";
import contents_mutations_analytics from "../../contents/mutations/analytics.spec";
import contents_mutations_popularity from "../../contents/mutations/popularity.spec";
import contents_sections_build from "../../contents/sections/build.spec";
import contents_sections_hits from "../../contents/sections/hits.spec";
import contents_sections_rows from "../../contents/sections/rows.spec";
import contents_sections_state from "../../contents/sections/state.spec";

const spec: Spec.Spec<{
  readonly contents: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "contents", never, GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "mutations", never, GroupSpec.NamedAt<typeof contents_mutations_analytics, "analytics"> | GroupSpec.NamedAt<typeof contents_mutations_popularity, "popularity">>, "mutations"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "sections", never, GroupSpec.NamedAt<typeof contents_sections_build, "build"> | GroupSpec.NamedAt<typeof contents_sections_hits, "hits"> | GroupSpec.NamedAt<typeof contents_sections_rows, "rows"> | GroupSpec.NamedAt<typeof contents_sections_state, "state">>, "sections">>, "contents">;
}> = Spec.fromGroups({ ["contents"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["mutations"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["analytics"]: contents_mutations_analytics, ["popularity"]: contents_mutations_popularity }), ["sections"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["build"]: contents_sections_build, ["hits"]: contents_sections_hits, ["rows"]: contents_sections_rows, ["state"]: contents_sections_state }) }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.contents;
