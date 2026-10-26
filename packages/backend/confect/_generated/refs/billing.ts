import { GroupSpec, Refs, Spec } from "@confect/core";
import billing_queries from "../../billing/queries.spec";
import billing_sessions from "../../billing/sessions.spec";
import billing_xendit_cancel from "../../billing/xendit/cancel.spec";

const spec: Spec.Spec<{
  readonly billing: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "billing", never, GroupSpec.NamedAt<typeof billing_queries, "queries"> | GroupSpec.NamedAt<typeof billing_sessions, "sessions"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "xendit", never, GroupSpec.NamedAt<typeof billing_xendit_cancel, "cancel">>, "xendit">>, "billing">;
}> = Spec.fromGroups({ ["billing"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["queries"]: billing_queries, ["sessions"]: billing_sessions, ["xendit"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["cancel"]: billing_xendit_cancel }) }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.billing;
