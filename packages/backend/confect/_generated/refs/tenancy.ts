import { GroupSpec, Refs, Spec } from "@confect/core";
import tenancy_memberships from "../../tenancy/memberships.spec";
import tenancy_profile from "../../tenancy/profile.spec";
import tenancy_viewer from "../../tenancy/viewer.spec";

const spec: Spec.Spec<{
  readonly tenancy: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "tenancy", never, GroupSpec.NamedAt<typeof tenancy_memberships, "memberships"> | GroupSpec.NamedAt<typeof tenancy_profile, "profile"> | GroupSpec.NamedAt<typeof tenancy_viewer, "viewer">>, "tenancy">;
}> = Spec.make().addAt("tenancy", GroupSpec.makeAt("tenancy").addGroupAt("memberships", tenancy_memberships).addGroupAt("profile", tenancy_profile).addGroupAt("viewer", tenancy_viewer));

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.tenancy;
