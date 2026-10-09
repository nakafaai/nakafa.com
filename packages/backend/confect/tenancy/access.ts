import { MiddlewareSpec } from "@confect/core";
import type { TenantPeopleDoc } from "@repo/backend/confect/_generated/docs";
import { entries } from "@repo/backend/confect/access/catalog";
import { Kind } from "@repo/backend/confect/access/kind";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import { Context } from "effect";

/** The Person that the function's `PersonAccess` check loaded and allowed. */
export class Person extends Context.Service<Person, TenantPeopleDoc>()(
  "@repo/backend/confect/tenancy/access/Person"
) {}

/** Checks a person action on the Person whose ID the `arg` argument holds. */
export class PersonAccess extends MiddlewareSpec.MiddlewareSpec<
  PersonAccess,
  { provides: Person; requires: Member }
>()("PersonAccess", Kind.middleware(entries, "person")) {}
