import type { GenericId } from "@confect/core";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { NotOperator } from "@repo/backend/confect/operators/errors";
import { Effect, Option } from "effect";

/** The operator row of one account, if Nakafa staff ever granted it. */
export const operatorOf = Effect.fn("operators.staff.of")(function* (
  userId: GenericId.GenericId<"users">
) {
  return yield* (yield* DatabaseReader)
    .table("operators")
    .index("by_userId", (query) => query.eq("userId", userId))
    .first()
    .pipe(Effect.orDie);
});

/** The operator row of an account whose operator access is active now. Any other account is `NotOperator`. */
const requireOperator = Effect.fn("operators.staff.require")(function* (
  userId: GenericId.GenericId<"users">
) {
  const found = yield* operatorOf(userId);
  if (Option.isSome(found) && found.value.status === "active") {
    return found.value;
  }
  return yield* new NotOperator();
});

/** The operator who calls the function: the session's account, which must hold active operator access. */
export const callingOperator = Effect.fn("operators.staff.caller")(
  function* () {
    const { appUser } = yield* requireAuth();
    return yield* requireOperator(appUser._id);
  }
);

/** Whether an account holds active operator access. A member of a school checks it before it acts there. */
export const isActiveOperator = Effect.fn("operators.staff.active")(function* (
  userId: GenericId.GenericId<"users">
) {
  return Option.exists(
    yield* operatorOf(userId),
    (operator) => operator.status === "active"
  );
});
