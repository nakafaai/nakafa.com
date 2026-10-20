import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { ClassForumInput, ShellInput } from "@/lib/tenant/classes";

/** The class of a forum page and the first page of its channels, which the forum's loader calls. */
export const readClassForumFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ClassForumInput))
  .handler(async (options) => {
    const { classForumHandler } = await import("@/lib/tenant/classes.server");
    return classForumHandler(options);
  });

/** The viewer's classes in the school's active periods, which the school layout's loader calls for its sidebar. */
export const readShellClassesFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ShellInput))
  .handler(async (options) => {
    const { shellClassesHandler } = await import("@/lib/tenant/classes.server");
    return shellClassesHandler(options);
  });
