import { GroupSpec, Refs, Spec } from "@confect/core";
import contents_mutations_views from "../../contents/mutations/views.spec";
import contents_queries_recent from "../../contents/queries/recent.spec";
import contents_queries_search from "../../contents/queries/search.spec";
import contents_queries_trending from "../../contents/queries/trending.spec";

const spec: Spec.Spec<{
  readonly contents: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "contents", never, GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "mutations", never, GroupSpec.NamedAt<typeof contents_mutations_views, "views">>, "mutations"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "queries", never, GroupSpec.NamedAt<typeof contents_queries_recent, "recent"> | GroupSpec.NamedAt<typeof contents_queries_search, "search"> | GroupSpec.NamedAt<typeof contents_queries_trending, "trending">>, "queries">>, "contents">;
}> = Spec.fromGroups({ ["contents"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["mutations"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["views"]: contents_mutations_views }), ["queries"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["recent"]: contents_queries_recent, ["search"]: contents_queries_search, ["trending"]: contents_queries_trending }) }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.contents;
