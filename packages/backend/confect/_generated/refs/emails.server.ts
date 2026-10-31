import { GroupSpec, Refs, Spec } from "@confect/core";
import emails_invite_delivery from "../../emails/invite/delivery.spec";
import emails_invite_internal from "../../emails/invite/internal.spec";
import emails_invite_workflow from "../../emails/invite/workflow.spec";
import emails_notice_delivery from "../../emails/notice/delivery.spec";
import emails_notice_internal from "../../emails/notice/internal.spec";
import emails_retention from "../../emails/retention.spec";
import emails_welcome_delivery from "../../emails/welcome/delivery.spec";
import emails_welcome_internal from "../../emails/welcome/internal.spec";
import emails_welcome_reconciliation from "../../emails/welcome/reconciliation.spec";
import emails_welcome_workflow from "../../emails/welcome/workflow.spec";

const spec: Spec.Spec<{
  readonly emails: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "emails", never, GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "invite", never, GroupSpec.NamedAt<typeof emails_invite_delivery, "delivery"> | GroupSpec.NamedAt<typeof emails_invite_internal, "internal"> | GroupSpec.NamedAt<typeof emails_invite_workflow, "workflow">>, "invite"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "notice", never, GroupSpec.NamedAt<typeof emails_notice_delivery, "delivery"> | GroupSpec.NamedAt<typeof emails_notice_internal, "internal">>, "notice"> | GroupSpec.NamedAt<typeof emails_retention, "retention"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "welcome", never, GroupSpec.NamedAt<typeof emails_welcome_delivery, "delivery"> | GroupSpec.NamedAt<typeof emails_welcome_internal, "internal"> | GroupSpec.NamedAt<typeof emails_welcome_reconciliation, "reconciliation"> | GroupSpec.NamedAt<typeof emails_welcome_workflow, "workflow">>, "welcome">>, "emails">;
}> = Spec.fromGroups({ ["emails"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["invite"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["delivery"]: emails_invite_delivery, ["internal"]: emails_invite_internal, ["workflow"]: emails_invite_workflow }), ["notice"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["delivery"]: emails_notice_delivery, ["internal"]: emails_notice_internal }), ["retention"]: emails_retention, ["welcome"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["delivery"]: emails_welcome_delivery, ["internal"]: emails_welcome_internal, ["reconciliation"]: emails_welcome_reconciliation, ["workflow"]: emails_welcome_workflow }) }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.emails;
