import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { MutationCtx as MutationCtxService } from "@repo/backend/confect/_generated/services";
import {
  setPreferredCurriculumProgram,
  setPreferredTryoutCountryProgram,
} from "@repo/backend/confect/learningPreferences/mutations";
import spec from "@repo/backend/confect/learningPreferences/mutations.spec";
import { Effect, Layer } from "effect";

const setPreferredCurriculum = FunctionImpl.make(
  databaseSchema,
  spec,
  "setPreferredCurriculum",
  Effect.fn("learningPreferences.mutations.setPreferredCurriculum")(
    function* (args) {
      const ctx = yield* MutationCtxService;
      return yield* setPreferredCurriculumProgram(ctx, args);
    }
  )
);
const setPreferredTryoutCountry = FunctionImpl.make(
  databaseSchema,
  spec,
  "setPreferredTryoutCountry",
  Effect.fn("learningPreferences.mutations.setPreferredTryoutCountry")(
    function* (args) {
      const ctx = yield* MutationCtxService;
      return yield* setPreferredTryoutCountryProgram(ctx, args);
    }
  )
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(setPreferredCurriculum),
  Layer.provide(setPreferredTryoutCountry),
  GroupImpl.finalize
);
