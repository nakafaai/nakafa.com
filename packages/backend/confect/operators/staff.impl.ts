import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import type { OperatorsDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  AccountNotFound,
  NotOperator,
} from "@repo/backend/confect/operators/errors";
import { operatorOf } from "@repo/backend/confect/operators/staff";
import spec from "@repo/backend/confect/operators/staff.spec";
import { Clock, Effect, Layer, Option } from "effect";

/** One operator row as the staff commands show it. */
const viewOf = (operator: OperatorsDoc) => ({
  changedAt: operator.changedAt,
  grantedAt: operator.grantedAt,
  id: operator._id,
  status: operator.status,
  userId: operator.userId,
});

/** Refuses an account ID that names no account. */
const requireAccount = Effect.fn("operators.staff.account")(function* (
  userId: GenericId.GenericId<"users">
) {
  yield* (yield* DatabaseReader)
    .table("users")
    .get(userId)
    .pipe(
      Effect.catchTags({
        DocumentDecodeError: Effect.die,
        GetByIdFailure: () => new AccountNotFound(),
      })
    );
});

/** Reads one operator row back as it is stored. */
const readOperator = Effect.fn("operators.staff.read")(function* (
  operatorId: GenericId.GenericId<"operators">
) {
  return viewOf(
    yield* (yield* DatabaseReader)
      .table("operators")
      .get(operatorId)
      .pipe(Effect.orDie)
  );
});

/**
 * Gives an account operator access. An account that already holds active access
 * is returned as it is. A revoked account is granted again, and both change
 * times move to now.
 */
const grant = FunctionImpl.make(
  databaseSchema,
  spec,
  "grant",
  Effect.fn("operators.staff.grant")(function* ({ userId }) {
    const writer = yield* DatabaseWriter;
    yield* requireAccount(userId);
    const found = yield* operatorOf(userId);
    if (Option.isSome(found) && found.value.status === "active") {
      return viewOf(found.value);
    }
    const at = yield* Clock.currentTimeMillis;
    if (Option.isNone(found)) {
      const operatorId = yield* writer
        .table("operators")
        .insert({ changedAt: at, grantedAt: at, status: "active", userId })
        .pipe(Effect.orDie);
      return yield* readOperator(operatorId);
    }
    yield* writer
      .table("operators")
      .patch(found.value._id, {
        changedAt: at,
        grantedAt: at,
        status: "active",
      })
      .pipe(Effect.orDie);
    return yield* readOperator(found.value._id);
  })
);

/**
 * Takes operator access away. The operator is refused everywhere at once: every
 * operator command and every member function of a school refuses a revoked
 * account. A visit it already holds ends at its own term, by the scheduled end or
 * the hourly sweep, which end the visit's grant and Person in that school. The
 * revoked row stays for the record.
 */
const revoke = FunctionImpl.make(
  databaseSchema,
  spec,
  "revoke",
  Effect.fn("operators.staff.revoke")(function* ({ userId }) {
    const found = yield* operatorOf(userId);
    if (Option.isNone(found)) {
      return yield* new NotOperator();
    }
    if (found.value.status === "revoked") {
      return viewOf(found.value);
    }
    const at = yield* Clock.currentTimeMillis;
    yield* (yield* DatabaseWriter)
      .table("operators")
      .patch(found.value._id, { changedAt: at, status: "revoked" })
      .pipe(Effect.orDie);
    return yield* readOperator(found.value._id);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(grant),
  Layer.provide(revoke),
  GroupImpl.finalize
);
