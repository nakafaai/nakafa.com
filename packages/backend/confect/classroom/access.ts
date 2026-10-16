import { MiddlewareSpec } from "@confect/core";
import type { ClassesDoc } from "@repo/backend/confect/_generated/docs";
import { entries } from "@repo/backend/confect/access/catalog";
import { Kind } from "@repo/backend/confect/access/kind";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import { Context } from "effect";

/** The class that the function's `ClassAccess` check loaded and allowed. */
export class Class extends Context.Service<Class, ClassesDoc>()(
  "@repo/backend/confect/classroom/access/Class"
) {}

/** Checks a class action on the class whose ID the `arg` argument holds. */
export class ClassAccess extends MiddlewareSpec.MiddlewareSpec<
  ClassAccess,
  { provides: Class; requires: Member }
>()("ClassAccess", Kind.middleware(entries, "class")) {}
