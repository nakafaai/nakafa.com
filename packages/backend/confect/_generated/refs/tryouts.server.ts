import { GroupSpec, Refs, Spec } from "@confect/core";
import tryouts_mutations_expiry from "../../tryouts/mutations/expiry.spec";
import tryouts_reminders_delivery from "../../tryouts/reminders/delivery.spec";
import tryouts_reminders_jobs from "../../tryouts/reminders/jobs.spec";

const spec: Spec.Spec<{
  readonly tryouts: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "tryouts", never, GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "mutations", never, GroupSpec.NamedAt<typeof tryouts_mutations_expiry, "expiry">>, "mutations"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "reminders", never, GroupSpec.NamedAt<typeof tryouts_reminders_delivery, "delivery"> | GroupSpec.NamedAt<typeof tryouts_reminders_jobs, "jobs">>, "reminders">>, "tryouts">;
}> = Spec.fromGroups({ ["tryouts"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["mutations"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["expiry"]: tryouts_mutations_expiry }), ["reminders"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["delivery"]: tryouts_reminders_delivery, ["jobs"]: tryouts_reminders_jobs }) }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.tryouts;
