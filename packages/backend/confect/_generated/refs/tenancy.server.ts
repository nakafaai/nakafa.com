import { GroupSpec, Refs, Spec } from "@confect/core";
import tenancy_claims from "../../tenancy/claims.spec";
import tenancy_expiry from "../../tenancy/expiry.spec";
import tenancy_holders from "../../tenancy/holders.spec";
import tenancy_promotion_run from "../../tenancy/promotion/run.spec";
import tenancy_provision from "../../tenancy/provision.spec";
import tenancy_seed from "../../tenancy/seed.spec";

const spec: Spec.Spec<{
  readonly tenancy: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "tenancy", never, GroupSpec.NamedAt<typeof tenancy_claims, "claims"> | GroupSpec.NamedAt<typeof tenancy_expiry, "expiry"> | GroupSpec.NamedAt<typeof tenancy_holders, "holders"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "promotion", never, GroupSpec.NamedAt<typeof tenancy_promotion_run, "run">>, "promotion"> | GroupSpec.NamedAt<typeof tenancy_provision, "provision"> | GroupSpec.NamedAt<typeof tenancy_seed, "seed">>, "tenancy">;
}> = Spec.fromGroups({ ["tenancy"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["claims"]: tenancy_claims, ["expiry"]: tenancy_expiry, ["holders"]: tenancy_holders, ["promotion"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["run"]: tenancy_promotion_run }), ["provision"]: tenancy_provision, ["seed"]: tenancy_seed }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.tenancy;
