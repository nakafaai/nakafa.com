import { GroupSpec, Refs, Spec } from "@confect/core";
import guardians_codes from "../../guardians/codes.spec";
import guardians_family from "../../guardians/family.spec";
import guardians_links from "../../guardians/links.spec";

const spec: Spec.Spec<{
  readonly guardians: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "guardians", never, GroupSpec.NamedAt<typeof guardians_codes, "codes"> | GroupSpec.NamedAt<typeof guardians_family, "family"> | GroupSpec.NamedAt<typeof guardians_links, "links">>, "guardians">;
}> = Spec.fromGroups({ ["guardians"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["codes"]: guardians_codes, ["family"]: guardians_family, ["links"]: guardians_links }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.guardians;
