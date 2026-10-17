import { GroupSpec, Refs, Spec } from "@confect/core";
import exams_exams from "../../exams/exams.spec";
import exams_questions from "../../exams/questions.spec";

const spec: Spec.Spec<{
  readonly exams: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "exams", never, GroupSpec.NamedAt<typeof exams_exams, "exams"> | GroupSpec.NamedAt<typeof exams_questions, "questions">>, "exams">;
}> = Spec.fromGroups({ ["exams"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["exams"]: exams_exams, ["questions"]: exams_questions }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.exams;
