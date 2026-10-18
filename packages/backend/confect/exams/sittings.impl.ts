import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { sittingAccess } from "@repo/backend/confect/exams/sittings/authority";
import { dashboard } from "@repo/backend/confect/exams/sittings/dashboard";
import { enter } from "@repo/backend/confect/exams/sittings/enter";
import { mine } from "@repo/backend/confect/exams/sittings/mine";
import {
  addMinutes,
  allowDevice,
  changeToken,
  close,
  lock,
  unlock,
} from "@repo/backend/confect/exams/sittings/proctor";
import { signal } from "@repo/backend/confect/exams/sittings/signal";
import spec from "@repo/backend/confect/exams/sittings.spec";
import member from "@repo/backend/confect/middleware/member.impl";
import session from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer } from "effect";

const enterFunction = FunctionImpl.make(
  databaseSchema,
  spec,
  "enter",
  Effect.fn("exams.sittings.enter.function")(function* (args) {
    return yield* enter(args);
  })
);

const signalFunction = FunctionImpl.make(
  databaseSchema,
  spec,
  "signal",
  Effect.fn("exams.sittings.signal.function")(function* (args) {
    return yield* signal(args);
  })
);

const mineFunction = FunctionImpl.make(
  databaseSchema,
  spec,
  "mine",
  Effect.fn("exams.sittings.mine.function")(function* () {
    return yield* mine();
  })
);

const dashboardFunction = FunctionImpl.make(
  databaseSchema,
  spec,
  "dashboard",
  Effect.fn("exams.sittings.dashboard.function")(function* (args) {
    return yield* dashboard(args);
  })
);

const lockFunction = FunctionImpl.make(
  databaseSchema,
  spec,
  "lock",
  Effect.fn("exams.sittings.lock.function")(function* (args) {
    return yield* lock(args);
  })
);

const unlockFunction = FunctionImpl.make(
  databaseSchema,
  spec,
  "unlock",
  Effect.fn("exams.sittings.unlock.function")(function* (args) {
    return yield* unlock(args);
  })
);

const addMinutesFunction = FunctionImpl.make(
  databaseSchema,
  spec,
  "addMinutes",
  Effect.fn("exams.sittings.addMinutes.function")(function* (args) {
    return yield* addMinutes(args);
  })
);

const allowDeviceFunction = FunctionImpl.make(
  databaseSchema,
  spec,
  "allowDevice",
  Effect.fn("exams.sittings.allowDevice.function")(function* (args) {
    return yield* allowDevice(args);
  })
);

const changeTokenFunction = FunctionImpl.make(
  databaseSchema,
  spec,
  "changeToken",
  Effect.fn("exams.sittings.changeToken.function")(function* () {
    return yield* changeToken();
  })
);

const closeFunction = FunctionImpl.make(
  databaseSchema,
  spec,
  "close",
  Effect.fn("exams.sittings.close.function")(function* () {
    return yield* close();
  })
);

/** Implements the sittings group of `sittings.spec.ts`: entry, signals, reads, and the six proctor actions. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(enterFunction),
  Layer.provide(signalFunction),
  Layer.provide(mineFunction),
  Layer.provide(dashboardFunction),
  Layer.provide(lockFunction),
  Layer.provide(unlockFunction),
  Layer.provide(addMinutesFunction),
  Layer.provide(allowDeviceFunction),
  Layer.provide(changeTokenFunction),
  Layer.provide(closeFunction),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(sittingAccess),
  GroupImpl.finalize
);
