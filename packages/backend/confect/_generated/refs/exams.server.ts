import { GroupSpec, Refs, Spec } from "@confect/core";
import exams_assets from "../../exams/assets.spec";
import exams_reads from "../../exams/reads.spec";
import exams_seed from "../../exams/seed.spec";
import exams_sittings_timers from "../../exams/sittings/timers.spec";

const spec: Spec.Spec<{
  readonly exams: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "exams", never, GroupSpec.NamedAt<typeof exams_assets, "assets"> | GroupSpec.NamedAt<typeof exams_reads, "reads"> | GroupSpec.NamedAt<typeof exams_seed, "seed"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "sittings", never, GroupSpec.NamedAt<typeof exams_sittings_timers, "timers">>, "sittings">>, "exams">;
}> = Spec.fromGroups({ ["exams"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["assets"]: exams_assets, ["reads"]: exams_reads, ["seed"]: exams_seed, ["sittings"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["timers"]: exams_sittings_timers }) }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.exams;
