import { GroupSpec, Refs, Spec } from "@confect/core";
import notifications_consume from "../../notifications/consume.spec";
import notifications_deliver from "../../notifications/deliver.spec";
import notifications_fanout from "../../notifications/fanout.spec";
import notifications_purge from "../../notifications/purge.spec";
import notifications_read from "../../notifications/read.spec";

const spec: Spec.Spec<{
  readonly notifications: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "notifications", never, GroupSpec.NamedAt<typeof notifications_consume, "consume"> | GroupSpec.NamedAt<typeof notifications_deliver, "deliver"> | GroupSpec.NamedAt<typeof notifications_fanout, "fanout"> | GroupSpec.NamedAt<typeof notifications_purge, "purge"> | GroupSpec.NamedAt<typeof notifications_read, "read">>, "notifications">;
}> = Spec.fromGroups({ ["notifications"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["consume"]: notifications_consume, ["deliver"]: notifications_deliver, ["fanout"]: notifications_fanout, ["purge"]: notifications_purge, ["read"]: notifications_read }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.notifications;
