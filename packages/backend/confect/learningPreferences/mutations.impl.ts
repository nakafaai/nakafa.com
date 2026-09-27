import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  setPreferredCurriculumProgram,
  setPreferredTryoutCountryProgram,
} from "@repo/backend/confect/learningPreferences/mutations";
import spec from "@repo/backend/confect/learningPreferences/mutations.spec";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer } from "effect";

const setPreferredCurriculum = FunctionImpl.make(
  databaseSchema,
  spec,
  "setPreferredCurriculum",
  Effect.fn("learningPreferences.mutations.setPreferredCurriculum")(
    function* (args) {
      return yield* setPreferredCurriculumProgram(args);
    }
  )
);
const setPreferredTryoutCountry = FunctionImpl.make(
  databaseSchema,
  spec,
  "setPreferredTryoutCountry",
  Effect.fn("learningPreferences.mutations.setPreferredTryoutCountry")(
    function* (args) {
      return yield* setPreferredTryoutCountryProgram(args);
    }
  )
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(setPreferredCurriculum),
  Layer.provide(setPreferredTryoutCountry),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
