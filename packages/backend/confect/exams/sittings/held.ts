import type {
  ExamAttemptsDoc,
  ExamSittingsDoc,
} from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Binding } from "@repo/backend/confect/assessment/gate/store";
import { AttemptState } from "@repo/backend/confect/exams/sittings/schema";
import { Effect, Option, Schema } from "effect";

/** The attempt of a sitting as the gate reads it: its ID, its device binding, deadline and state. */
export const HeldAttempt = Schema.Struct({
  _id: Id("examAttempts"),
  binding: Binding,
  deadline: Schema.Finite,
  state: AttemptState,
});
export type HeldAttempt = typeof HeldAttempt.Type;

/** The device binding of an attempt: the device that owns it, or none while a proctor allows another. */
const bindingOf = (
  attempt: Pick<ExamAttemptsDoc, "deviceId" | "retiredDeviceIds">
): Binding =>
  attempt.deviceId === null
    ? { kind: "unbound", retired: attempt.retiredDeviceIds }
    : {
        device: attempt.deviceId,
        kind: "bound",
        retired: attempt.retiredDeviceIds,
      };

/** The attempt as the gate reads it, with its ID. */
export const heldOf = (row: ExamAttemptsDoc): HeldAttempt => ({
  _id: row._id,
  binding: bindingOf(row),
  deadline: row.deadline,
  state: row.state,
});

/** The sitting of the tenant, or none: another school's sitting is none. */
export const readSitting = Effect.fn("exams.sittings.gate.sitting")(function* (
  sittingId: ExamSittingsDoc["_id"],
  tenantId: ExamSittingsDoc["tenantId"]
) {
  const found = yield* (yield* DatabaseReader)
    .table("examSittings")
    .get(sittingId)
    .pipe(Effect.catchTag("DocumentDecodeError", Effect.die), Effect.option);
  return Option.filter(found, (sitting) => sitting.tenantId === tenantId);
});
