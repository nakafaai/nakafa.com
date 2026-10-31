import { GroupSpec, Refs, Spec } from "@confect/core";
import triggers_chats_cleanup from "../../triggers/chats/cleanup.spec";
import triggers_comments_cleanup from "../../triggers/comments/cleanup.spec";

const spec: Spec.Spec<{
  readonly triggers: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "triggers", never, GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "chats", never, GroupSpec.NamedAt<typeof triggers_chats_cleanup, "cleanup">>, "chats"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "comments", never, GroupSpec.NamedAt<typeof triggers_comments_cleanup, "cleanup">>, "comments">>, "triggers">;
}> = Spec.fromGroups({ ["triggers"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["chats"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["cleanup"]: triggers_chats_cleanup }), ["comments"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["cleanup"]: triggers_comments_cleanup }) }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.triggers;
