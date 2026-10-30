import { GroupSpec, Refs, Spec } from "@confect/core";
import tryouts_mutations_expiry from "../../tryouts/mutations/expiry.spec";
import tryouts_runtime_signed from "../../tryouts/runtime/signed.spec";

const spec: Spec.Spec<{
  readonly tryouts: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "tryouts", never, GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "mutations", never, GroupSpec.NamedAt<typeof tryouts_mutations_expiry, "expiry">>, "mutations"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "runtime", never, GroupSpec.NamedAt<typeof tryouts_runtime_signed, "signed">>, "runtime">>, "tryouts">;
}> = Spec.fromGroups({ ["tryouts"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["mutations"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["expiry"]: tryouts_mutations_expiry }), ["runtime"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["signed"]: tryouts_runtime_signed }) }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.tryouts;
