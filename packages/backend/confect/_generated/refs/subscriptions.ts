import { GroupSpec, Refs, Spec } from "@confect/core";
import subscriptions_queries from "../../subscriptions/queries.spec";

const spec: Spec.Spec<{
  readonly subscriptions: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "subscriptions", never, GroupSpec.NamedAt<typeof subscriptions_queries, "queries">>, "subscriptions">;
}> = Spec.make().addAt("subscriptions", GroupSpec.makeAt("subscriptions").addGroupAt("queries", subscriptions_queries));

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.subscriptions;
