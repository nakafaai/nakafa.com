import { GroupSpec, Refs, Spec } from "@confect/core";
import tenancy_cohorts from "../../tenancy/cohorts.spec";
import tenancy_invites from "../../tenancy/invites.spec";
import tenancy_memberships from "../../tenancy/memberships.spec";
import tenancy_people from "../../tenancy/people.spec";
import tenancy_periods from "../../tenancy/periods.spec";
import tenancy_placements from "../../tenancy/placements.spec";
import tenancy_profile from "../../tenancy/profile.spec";
import tenancy_settings from "../../tenancy/settings.spec";
import tenancy_units from "../../tenancy/units.spec";
import tenancy_viewer from "../../tenancy/viewer.spec";

const spec: Spec.Spec<{
  readonly tenancy: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "tenancy", never, GroupSpec.NamedAt<typeof tenancy_cohorts, "cohorts"> | GroupSpec.NamedAt<typeof tenancy_invites, "invites"> | GroupSpec.NamedAt<typeof tenancy_memberships, "memberships"> | GroupSpec.NamedAt<typeof tenancy_people, "people"> | GroupSpec.NamedAt<typeof tenancy_periods, "periods"> | GroupSpec.NamedAt<typeof tenancy_placements, "placements"> | GroupSpec.NamedAt<typeof tenancy_profile, "profile"> | GroupSpec.NamedAt<typeof tenancy_settings, "settings"> | GroupSpec.NamedAt<typeof tenancy_units, "units"> | GroupSpec.NamedAt<typeof tenancy_viewer, "viewer">>, "tenancy">;
}> = Spec.make().addAt("tenancy", GroupSpec.makeAt("tenancy").addGroupAt("cohorts", tenancy_cohorts).addGroupAt("invites", tenancy_invites).addGroupAt("memberships", tenancy_memberships).addGroupAt("people", tenancy_people).addGroupAt("periods", tenancy_periods).addGroupAt("placements", tenancy_placements).addGroupAt("profile", tenancy_profile).addGroupAt("settings", tenancy_settings).addGroupAt("units", tenancy_units).addGroupAt("viewer", tenancy_viewer));

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.tenancy;
