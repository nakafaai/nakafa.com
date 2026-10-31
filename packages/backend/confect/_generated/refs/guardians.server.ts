import { GroupSpec, Refs, Spec } from "@confect/core";
import guardians_codes from "../../guardians/codes.spec";
import guardians_seed from "../../guardians/seed.spec";

const spec: Spec.Spec<{
  readonly guardians: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "guardians", never, GroupSpec.NamedAt<typeof guardians_codes, "codes"> | GroupSpec.NamedAt<typeof guardians_seed, "seed">>, "guardians">;
}> = Spec.fromGroups({ ["guardians"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["codes"]: guardians_codes, ["seed"]: guardians_seed }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.guardians;
