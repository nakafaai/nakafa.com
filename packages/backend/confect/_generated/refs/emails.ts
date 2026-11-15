import { GroupSpec, Refs, Spec } from "@confect/core";
import emails_unsubscribe_requests from "../../emails/unsubscribe/requests.spec";

const spec: Spec.Spec<{
  readonly emails: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "emails", never, GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "unsubscribe", never, GroupSpec.NamedAt<typeof emails_unsubscribe_requests, "requests">>, "unsubscribe">>, "emails">;
}> = Spec.fromGroups({ ["emails"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["unsubscribe"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["requests"]: emails_unsubscribe_requests }) }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.emails;
