import { GroupSpec, Refs, Spec } from "@confect/core";
import customers_actions_sessions from "../../customers/actions/sessions.spec";

const spec: Spec.Spec<{
  readonly customers: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "customers", never, GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "actions", never, GroupSpec.NamedAt<typeof customers_actions_sessions, "sessions">>, "actions">>, "customers">;
}> = Spec.fromGroups({ ["customers"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["actions"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["sessions"]: customers_actions_sessions }) }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.customers;
