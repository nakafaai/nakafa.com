import { GroupSpec, Refs, Spec } from "@confect/core";
import exams_assets from "../../exams/assets.spec";
import exams_exams from "../../exams/exams.spec";
import exams_imports from "../../exams/imports.spec";
import exams_joins from "../../exams/joins.spec";
import exams_presence from "../../exams/presence.spec";
import exams_questions from "../../exams/questions.spec";
import exams_reads from "../../exams/reads.spec";
import exams_results_results from "../../exams/results/results.spec";
import exams_rooms from "../../exams/rooms.spec";
import exams_screens from "../../exams/screens.spec";
import exams_sittings from "../../exams/sittings.spec";

const spec: Spec.Spec<{
  readonly exams: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "exams", never, GroupSpec.NamedAt<typeof exams_assets, "assets"> | GroupSpec.NamedAt<typeof exams_exams, "exams"> | GroupSpec.NamedAt<typeof exams_imports, "imports"> | GroupSpec.NamedAt<typeof exams_joins, "joins"> | GroupSpec.NamedAt<typeof exams_presence, "presence"> | GroupSpec.NamedAt<typeof exams_questions, "questions"> | GroupSpec.NamedAt<typeof exams_reads, "reads"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "results", never, GroupSpec.NamedAt<typeof exams_results_results, "results">>, "results"> | GroupSpec.NamedAt<typeof exams_rooms, "rooms"> | GroupSpec.NamedAt<typeof exams_screens, "screens"> | GroupSpec.NamedAt<typeof exams_sittings, "sittings">>, "exams">;
}> = Spec.fromGroups({ ["exams"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["assets"]: exams_assets, ["exams"]: exams_exams, ["imports"]: exams_imports, ["joins"]: exams_joins, ["presence"]: exams_presence, ["questions"]: exams_questions, ["reads"]: exams_reads, ["results"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["results"]: exams_results_results }), ["rooms"]: exams_rooms, ["screens"]: exams_screens, ["sittings"]: exams_sittings }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.exams;
