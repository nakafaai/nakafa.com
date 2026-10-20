import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import {
  ClassForumInput,
  classForumHandler,
  ShellInput,
  shellClassesHandler,
} from "@/lib/tenant/classes.server";

/** The class of a forum page and the first page of its channels, which the forum's loader calls. */
export const readClassForumFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ClassForumInput))
  .handler(classForumHandler);

/** The viewer's classes in the school's active periods, which the school layout's loader calls for its sidebar. */
export const readShellClassesFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ShellInput))
  .handler(shellClassesHandler);
