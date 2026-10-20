import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import {
  ClassForumInput,
  ClassInput,
  classForumHandler,
  classHandler,
  ShellInput,
  shellClassesHandler,
} from "@/lib/tenant/classes.server";

/** The class of a home page, which the class home's loader calls. */
export const readClassFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ClassInput))
  .handler(classHandler);

/** The class of a forum page and the first page of its channels, which the forum's loader calls. */
export const readClassForumFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ClassForumInput))
  .handler(classForumHandler);

/** The viewer's classes in the school's active periods, which the school layout's loader calls for its sidebar. */
export const readShellClassesFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ShellInput))
  .handler(shellClassesHandler);
