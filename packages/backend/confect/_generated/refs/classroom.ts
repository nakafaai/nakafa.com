import { GroupSpec, Refs, Spec } from "@confect/core";
import classroom_classes from "../../classroom/classes.spec";
import classroom_teachers from "../../classroom/teachers.spec";

const spec: Spec.Spec<{
  readonly classroom: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "classroom", never, GroupSpec.NamedAt<typeof classroom_classes, "classes"> | GroupSpec.NamedAt<typeof classroom_teachers, "teachers">>, "classroom">;
}> = Spec.make().addAt("classroom", GroupSpec.makeAt("classroom").addGroupAt("classes", classroom_classes).addGroupAt("teachers", classroom_teachers));

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.classroom;
