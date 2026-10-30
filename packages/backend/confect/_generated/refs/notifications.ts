import { GroupSpec, Refs, Spec } from "@confect/core";
import notifications_inbox from "../../notifications/inbox.spec";
import notifications_push from "../../notifications/push.spec";

const spec: Spec.Spec<{
  readonly notifications: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "notifications", never, GroupSpec.NamedAt<typeof notifications_inbox, "inbox"> | GroupSpec.NamedAt<typeof notifications_push, "push">>, "notifications">;
}> = Spec.fromGroups({ ["notifications"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["inbox"]: notifications_inbox, ["push"]: notifications_push }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.notifications;
