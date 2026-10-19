import { GroupSpec, Refs, Spec } from "@confect/core";
import exams_assets from "../../exams/assets.spec";
import exams_exams from "../../exams/exams.spec";
import exams_questions from "../../exams/questions.spec";
import exams_sittings from "../../exams/sittings.spec";

const spec: Spec.Spec<{
  readonly exams: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "exams", never, GroupSpec.NamedAt<typeof exams_assets, "assets"> | GroupSpec.NamedAt<typeof exams_exams, "exams"> | GroupSpec.NamedAt<typeof exams_questions, "questions"> | GroupSpec.NamedAt<typeof exams_sittings, "sittings">>, "exams">;
}> = Spec.fromGroups({ ["exams"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["assets"]: exams_assets, ["exams"]: exams_exams, ["questions"]: exams_questions, ["sittings"]: exams_sittings }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.exams;
