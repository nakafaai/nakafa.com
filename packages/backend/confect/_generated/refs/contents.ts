import { GroupSpec, Refs, Spec } from "@confect/core";
import contents_mutations_views from "../../contents/mutations/views.spec";
import contents_queries_recent from "../../contents/queries/recent.spec";
import contents_queries_search from "../../contents/queries/search.spec";
import contents_queries_trending from "../../contents/queries/trending.spec";

const spec: Spec.Spec<{
  readonly contents: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "contents", never, GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "mutations", never, GroupSpec.NamedAt<typeof contents_mutations_views, "views">>, "mutations"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "queries", never, GroupSpec.NamedAt<typeof contents_queries_recent, "recent"> | GroupSpec.NamedAt<typeof contents_queries_search, "search"> | GroupSpec.NamedAt<typeof contents_queries_trending, "trending">>, "queries">>, "contents">;
}> = Spec.make().addAt("contents", GroupSpec.makeAt("contents").addGroupAt("mutations", GroupSpec.makeAt("mutations").addGroupAt("views", contents_mutations_views)).addGroupAt("queries", GroupSpec.makeAt("queries").addGroupAt("recent", contents_queries_recent).addGroupAt("search", contents_queries_search).addGroupAt("trending", contents_queries_trending)));

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.contents;
