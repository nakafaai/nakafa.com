import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { ClassForumInput } from "@/lib/tenant/classes";

/** The class of a gradebook page, its scheme, and the gradebook's first page, which its loader calls. */
export const readClassGradesFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ClassForumInput))
  .handler(async (options) => {
    const { classGradesHandler } = await import("@/lib/tenant/grades.server");
    return classGradesHandler(options);
  });
