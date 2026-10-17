import { GroupSpec, Refs, Spec } from "@confect/core";
import subscriptions_queries from "../../subscriptions/queries.spec";

const spec: Spec.Spec<{
  readonly subscriptions: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "subscriptions", never, GroupSpec.NamedAt<typeof subscriptions_queries, "queries">>, "subscriptions">;
}> = Spec.fromGroups({ ["subscriptions"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["queries"]: subscriptions_queries }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.subscriptions;
