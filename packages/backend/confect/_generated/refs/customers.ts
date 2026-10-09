import { GroupSpec, Refs, Spec } from "@confect/core";
import customers_actions_sessions from "../../customers/actions/sessions.spec";

const spec: Spec.Spec<{
  readonly customers: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "customers", never, GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "actions", never, GroupSpec.NamedAt<typeof customers_actions_sessions, "sessions">>, "actions">>, "customers">;
}> = Spec.make().addAt("customers", GroupSpec.makeAt("customers").addGroupAt("actions", GroupSpec.makeAt("actions").addGroupAt("sessions", customers_actions_sessions)));

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.customers;
