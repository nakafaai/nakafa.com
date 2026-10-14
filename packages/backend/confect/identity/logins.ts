import type { TenantPeopleDoc } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  LoginExists,
  type LoginNameRefusal,
  LoginNameTaken,
} from "@repo/backend/confect/identity/errors";
import {
  LOGIN_NAME_MAX_LENGTH,
  LOGIN_NAME_MIN_LENGTH,
  LOGIN_NAME_PATTERN,
} from "@repo/backend/confect/identity/schema";
import { Effect, HashSet, Option, pipe, Result, String as Str } from "effect";

/**
 * The names that no school may give, so a login never reads like Nakafa, its
 * staff, or one of its tools.
 */
const RESERVED_LOGIN_NAMES = HashSet.fromIterable([
  "admin",
  "administrator",
  "api",
  "dev",
  "help",
  "login",
  "nakafa",
  "nina",
  "operator",
  "root",
  "support",
  "system",
  "test",
]);

/**
 * Reads a login name as a person typed it: spaces around it drop and capitals
 * are lowercased. The reasons come in the order a person fixes them: the
 * length, then a character, then a reserved name.
 */
export function readLoginName(
  input: string
): Result.Result<string, typeof LoginNameRefusal.Type> {
  const name = pipe(input, Str.trim, Str.toLowerCase);
  if (
    name.length < LOGIN_NAME_MIN_LENGTH ||
    name.length > LOGIN_NAME_MAX_LENGTH
  ) {
    return Result.fail("length");
  }
  if (!LOGIN_NAME_PATTERN.test(name)) {
    return Result.fail("characters");
  }
  if (HashSet.has(RESERVED_LOGIN_NAMES, name)) {
    return Result.fail("reserved");
  }
  return Result.succeed(name);
}

/** The school login of one Person, if it has one: one indexed read. */
export const loginOf = Effect.fn("identity.logins.of")(function* (
  personId: TenantPeopleDoc["_id"]
) {
  return yield* (yield* DatabaseReader)
    .table("schoolLogins")
    .get("by_personId", personId)
    .pipe(
      Effect.asSome,
      Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
      Effect.orDie
    );
});

/**
 * Gives one Person the school's login name, once. A name belongs to one Person
 * of its school, and a Person holds one name, so the two checks are the only
 * refusals. The caller's transaction writes the row, so two requests for one
 * name cannot both win.
 */
export const claimLoginName = Effect.fn("identity.logins.claim")(function* (
  person: TenantPeopleDoc,
  name: string
) {
  if (Option.isSome(yield* loginOf(person._id))) {
    return yield* new LoginExists();
  }
  const taken = yield* (yield* DatabaseReader)
    .table("schoolLogins")
    .index("by_tenantId_and_name", (query) =>
      query.eq("tenantId", person.tenantId).eq("name", name)
    )
    .first()
    .pipe(Effect.orDie);
  if (Option.isSome(taken)) {
    return yield* new LoginNameTaken();
  }
  yield* (yield* DatabaseWriter)
    .table("schoolLogins")
    .insert({ name, personId: person._id, tenantId: person.tenantId })
    .pipe(Effect.orDie);
});
