import type { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type {
  ActionOf,
  IdOf,
  ResourceKind,
  SubjectOf,
} from "@repo/backend/confect/access/catalog";
import type { AccessDenied } from "@repo/backend/confect/access/errors";
import { allowedOn, checkId } from "@repo/backend/confect/access/policy";
import { registry } from "@repo/backend/confect/access/registry";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Effect } from "effect";

/**
 * Checks `action` on another object a handler names, reusing the member's
 * grants, and returns the checked row. A missing object and another tenant's
 * object get the same denial.
 */
export const authorize = Effect.fn("access.authorize")(function* <
  K extends ResourceKind,
>(
  kind: K,
  action: ActionOf<K>,
  id: IdOf<K>
): Effect.fn.Return<SubjectOf<K>, AccessDenied, DatabaseReader | Member> {
  return yield* checkId(registry[kind], action, id, yield* Member);
});

/** The actions of kind `K` the caller may perform on a row the handler already loaded. */
export const allowed = Effect.fn("access.allowed")(function* <
  K extends ResourceKind,
>(
  kind: K,
  row: SubjectOf<K>
): Effect.fn.Return<readonly ActionOf<K>[], never, DatabaseReader | Member> {
  return yield* allowedOn(registry[kind], row, yield* Member);
});
