import { GroupSpec, Refs, Spec } from "@confect/core";
import billing_queries from "../../billing/queries.spec";
import billing_sessions from "../../billing/sessions.spec";

const spec: Spec.Spec<{
  readonly billing: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "billing", never, GroupSpec.NamedAt<typeof billing_queries, "queries"> | GroupSpec.NamedAt<typeof billing_sessions, "sessions">>, "billing">;
}> = Spec.fromGroups({ ["billing"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["queries"]: billing_queries, ["sessions"]: billing_sessions }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.billing;
