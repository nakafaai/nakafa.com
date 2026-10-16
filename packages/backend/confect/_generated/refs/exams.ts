import { GroupSpec, Refs, Spec } from "@confect/core";
import exams_exams from "../../exams/exams.spec";
import exams_questions from "../../exams/questions.spec";

const spec: Spec.Spec<{
  readonly exams: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "exams", never, GroupSpec.NamedAt<typeof exams_exams, "exams"> | GroupSpec.NamedAt<typeof exams_questions, "questions">>, "exams">;
}> = Spec.make().addAt("exams", GroupSpec.makeAt("exams").addGroupAt("exams", exams_exams).addGroupAt("questions", exams_questions));

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.exams;
