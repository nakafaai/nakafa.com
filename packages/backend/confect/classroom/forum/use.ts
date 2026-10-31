import type { GenericId } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Effect, Number as Num, Option, Schema, Struct } from "effect";

/**
 * The most bytes the forum of one school holds, counted from each file, the guard
 * that keeps one school from spending the storage of all. A compressed photo is
 * about 300 KB, so this holds about 35,000 of them, more than a school of 500 sends
 * in two years. The plan may set another number later (ADR 0028).
 */
export const SCHOOL_BYTE_LIMIT = 10 * 1024 * 1024 * 1024;

/** How many bytes the forum of one school holds. */
export const fileUseValidator = Schema.Struct({
  bytes: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  tenantId: Id("tenants"),
});

/** The row of a school's use, if it stored a file. */
const useOf = Effect.fn("classroom.forum.use.read")(function* (
  tenantId: GenericId.GenericId<"tenants">
) {
  return yield* (yield* DatabaseReader)
    .table("classroomFileUse")
    .index("by_tenantId", (query) => query.eq("tenantId", tenantId))
    .first()
    .pipe(Effect.orDie);
});

/** Adds bytes to a school's use, and answers false, adding nothing, when they pass the limit. */
export const chargeBytes = Effect.fn("classroom.forum.use.charge")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  bytes: number
) {
  const use = yield* useOf(tenantId);
  const held = Option.match(use, {
    onNone: () => 0,
    onSome: (row) => row.bytes,
  });
  if (held + bytes > SCHOOL_BYTE_LIMIT) {
    return false;
  }
  const writer = (yield* DatabaseWriter).table("classroomFileUse");
  yield* Option.match(use, {
    onNone: () => writer.insert({ bytes, tenantId }),
    onSome: (row) =>
      writer.replace(
        row._id,
        Struct.assign(Struct.omit(row, ["_creationTime", "_id"]), {
          bytes: held + bytes,
        })
      ),
  }).pipe(Effect.orDie);
  return true;
});

/** Takes the bytes of deleted files from a school's use. */
export const refundBytes = Effect.fn("classroom.forum.use.refund")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  bytes: number
) {
  const use = yield* useOf(tenantId);
  if (Option.isNone(use)) {
    return;
  }
  const row = use.value;
  yield* (yield* DatabaseWriter)
    .table("classroomFileUse")
    .replace(
      row._id,
      Struct.assign(Struct.omit(row, ["_creationTime", "_id"]), {
        bytes: Num.max(0, row.bytes - bytes),
      })
    )
    .pipe(Effect.orDie);
});
