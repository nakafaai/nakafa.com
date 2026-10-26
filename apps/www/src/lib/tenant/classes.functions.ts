import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import {
  ClassDiscussionInput,
  ClassForumInput,
  ShellInput,
} from "@/lib/tenant/classes";

/** The class of a forum page and the first page of its channels, which the forum's loader calls. */
export const readClassForumFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ClassForumInput))
  .handler(async (options) => {
    const { classForumHandler } = await import("@/lib/tenant/classes.server");
    return classForumHandler(options);
  });

/** The class of a discussion page, the first page of its channels, and the discussion, which the discussion's loader calls. */
export const readClassDiscussionFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ClassDiscussionInput))
  .handler(async (options) => {
    const { classDiscussionHandler } = await import(
      "@/lib/tenant/classes.server"
    );
    return classDiscussionHandler(options);
  });

/** The viewer's classes in the school's active periods, which the school layout's loader calls for its sidebar. */
export const readShellClassesFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ShellInput))
  .handler(async (options) => {
    const { shellClassesHandler } = await import("@/lib/tenant/classes.server");
    return shellClassesHandler(options);
  });
