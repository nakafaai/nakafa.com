import { GroupSpec, Refs, Spec } from "@confect/core";
import tenancy_assignments from "../../tenancy/assignments.spec";
import tenancy_cohorts from "../../tenancy/cohorts.spec";
import tenancy_home from "../../tenancy/home.spec";
import tenancy_invites from "../../tenancy/invites.spec";
import tenancy_logo from "../../tenancy/logo.spec";
import tenancy_memberships from "../../tenancy/memberships.spec";
import tenancy_people from "../../tenancy/people.spec";
import tenancy_periods from "../../tenancy/periods.spec";
import tenancy_placements from "../../tenancy/placements.spec";
import tenancy_profile from "../../tenancy/profile.spec";
import tenancy_promotion_apply from "../../tenancy/promotion/apply.spec";
import tenancy_promotion_draft from "../../tenancy/promotion/draft.spec";
import tenancy_promotion_moves from "../../tenancy/promotion/moves.spec";
import tenancy_promotion_review from "../../tenancy/promotion/review.spec";
import tenancy_promotion_undo from "../../tenancy/promotion/undo.spec";
import tenancy_roster from "../../tenancy/roster.spec";
import tenancy_settings from "../../tenancy/settings.spec";
import tenancy_start from "../../tenancy/start.spec";
import tenancy_units from "../../tenancy/units.spec";
import tenancy_viewer from "../../tenancy/viewer.spec";

const spec: Spec.Spec<{
  readonly tenancy: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "tenancy", never, GroupSpec.NamedAt<typeof tenancy_assignments, "assignments"> | GroupSpec.NamedAt<typeof tenancy_cohorts, "cohorts"> | GroupSpec.NamedAt<typeof tenancy_home, "home"> | GroupSpec.NamedAt<typeof tenancy_invites, "invites"> | GroupSpec.NamedAt<typeof tenancy_logo, "logo"> | GroupSpec.NamedAt<typeof tenancy_memberships, "memberships"> | GroupSpec.NamedAt<typeof tenancy_people, "people"> | GroupSpec.NamedAt<typeof tenancy_periods, "periods"> | GroupSpec.NamedAt<typeof tenancy_placements, "placements"> | GroupSpec.NamedAt<typeof tenancy_profile, "profile"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "promotion", never, GroupSpec.NamedAt<typeof tenancy_promotion_apply, "apply"> | GroupSpec.NamedAt<typeof tenancy_promotion_draft, "draft"> | GroupSpec.NamedAt<typeof tenancy_promotion_moves, "moves"> | GroupSpec.NamedAt<typeof tenancy_promotion_review, "review"> | GroupSpec.NamedAt<typeof tenancy_promotion_undo, "undo">>, "promotion"> | GroupSpec.NamedAt<typeof tenancy_roster, "roster"> | GroupSpec.NamedAt<typeof tenancy_settings, "settings"> | GroupSpec.NamedAt<typeof tenancy_start, "start"> | GroupSpec.NamedAt<typeof tenancy_units, "units"> | GroupSpec.NamedAt<typeof tenancy_viewer, "viewer">>, "tenancy">;
}> = Spec.fromGroups({ ["tenancy"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["assignments"]: tenancy_assignments, ["cohorts"]: tenancy_cohorts, ["home"]: tenancy_home, ["invites"]: tenancy_invites, ["logo"]: tenancy_logo, ["memberships"]: tenancy_memberships, ["people"]: tenancy_people, ["periods"]: tenancy_periods, ["placements"]: tenancy_placements, ["profile"]: tenancy_profile, ["promotion"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["apply"]: tenancy_promotion_apply, ["draft"]: tenancy_promotion_draft, ["moves"]: tenancy_promotion_moves, ["review"]: tenancy_promotion_review, ["undo"]: tenancy_promotion_undo }), ["roster"]: tenancy_roster, ["settings"]: tenancy_settings, ["start"]: tenancy_start, ["units"]: tenancy_units, ["viewer"]: tenancy_viewer }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.tenancy;
