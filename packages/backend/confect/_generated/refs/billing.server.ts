import { GroupSpec, Refs, Spec } from "@confect/core";
import billing_accounts from "../../billing/accounts.spec";
import billing_checkout from "../../billing/checkout.spec";
import billing_contracts from "../../billing/contracts.spec";
import billing_deletion from "../../billing/deletion.spec";
import billing_events from "../../billing/events.spec";
import billing_grants from "../../billing/grants.spec";
import billing_reconcile from "../../billing/reconcile.spec";
import billing_reminder_delivery from "../../billing/reminder/delivery.spec";
import billing_reminder_internal from "../../billing/reminder/internal.spec";
import billing_topup from "../../billing/topup.spec";
import billing_xendit_cancel from "../../billing/xendit/cancel.spec";
import billing_xendit_checkout from "../../billing/xendit/checkout.spec";
import billing_xendit_invoice from "../../billing/xendit/invoice.spec";
import billing_xendit_renewal from "../../billing/xendit/renewal.spec";

const spec: Spec.Spec<{
  readonly billing: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "billing", never, GroupSpec.NamedAt<typeof billing_accounts, "accounts"> | GroupSpec.NamedAt<typeof billing_checkout, "checkout"> | GroupSpec.NamedAt<typeof billing_contracts, "contracts"> | GroupSpec.NamedAt<typeof billing_deletion, "deletion"> | GroupSpec.NamedAt<typeof billing_events, "events"> | GroupSpec.NamedAt<typeof billing_grants, "grants"> | GroupSpec.NamedAt<typeof billing_reconcile, "reconcile"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "reminder", never, GroupSpec.NamedAt<typeof billing_reminder_delivery, "delivery"> | GroupSpec.NamedAt<typeof billing_reminder_internal, "internal">>, "reminder"> | GroupSpec.NamedAt<typeof billing_topup, "topup"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "xendit", never, GroupSpec.NamedAt<typeof billing_xendit_cancel, "cancel"> | GroupSpec.NamedAt<typeof billing_xendit_checkout, "checkout"> | GroupSpec.NamedAt<typeof billing_xendit_invoice, "invoice"> | GroupSpec.NamedAt<typeof billing_xendit_renewal, "renewal">>, "xendit">>, "billing">;
}> = Spec.fromGroups({ ["billing"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["accounts"]: billing_accounts, ["checkout"]: billing_checkout, ["contracts"]: billing_contracts, ["deletion"]: billing_deletion, ["events"]: billing_events, ["grants"]: billing_grants, ["reconcile"]: billing_reconcile, ["reminder"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["delivery"]: billing_reminder_delivery, ["internal"]: billing_reminder_internal }), ["topup"]: billing_topup, ["xendit"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["cancel"]: billing_xendit_cancel, ["checkout"]: billing_xendit_checkout, ["invoice"]: billing_xendit_invoice, ["renewal"]: billing_xendit_renewal }) }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.billing;
