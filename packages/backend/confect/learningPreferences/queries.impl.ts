import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import {
  readCurrentTryoutCountry,
  toTryoutCountryOption,
} from "@repo/backend/confect/learningPreferences/impl";
import {
  listCurriculumPrograms as listCurriculumProgramOptions,
  readCurrentCurriculumProgram,
} from "@repo/backend/confect/learningPreferences/program";
import spec, {
  LearningPreferenceIoError,
  learningPreferenceIoFailedCode,
  learningPreferenceIoFailedMessage,
} from "@repo/backend/confect/learningPreferences/queries.spec";
import { Effect, Layer } from "effect";

function toLearningPreferenceIoError() {
  return new LearningPreferenceIoError({
    code: learningPreferenceIoFailedCode,
    message: learningPreferenceIoFailedMessage,
  });
}

const listCurriculumPrograms = FunctionImpl.make(
  databaseSchema,
  spec,
  "listCurriculumPrograms",
  Effect.fn("learningPreferences.queries.listCurriculumPrograms")(function* ({
    locale,
  }) {
    const ctx = yield* QueryCtxService;
    return yield* listCurriculumProgramOptions(ctx, locale);
  })
);
const getCurrent = FunctionImpl.make(
  databaseSchema,
  spec,
  "getCurrent",
  Effect.fn("learningPreferences.queries.getCurrent")(function* ({ locale }) {
    const ctx = yield* QueryCtxService;
    return yield* Effect.gen(function* () {
      const user = yield* getOptionalAppUserForRead(ctx).pipe(
        Effect.mapError(toLearningPreferenceIoError)
      );
      if (!user) {
        return null;
      }
      return yield* readCurrentCurriculumProgram(ctx, locale, user.appUser._id);
    });
  })
);
const getCurrentTryout = FunctionImpl.make(
  databaseSchema,
  spec,
  "getCurrentTryout",
  Effect.fn("learningPreferences.queries.getCurrentTryout")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* Effect.gen(function* () {
      const user = yield* getOptionalAppUserForRead(ctx).pipe(
        Effect.mapError(toLearningPreferenceIoError)
      );
      if (!user) {
        return null;
      }
      const preference = yield* readCurrentTryoutCountry(ctx, {
        locale: args.locale,
        userId: user.appUser._id,
      });
      if (!preference) {
        return null;
      }
      return {
        country: toTryoutCountryOption(preference.country),
        preferredTryoutCountryKey: preference.preferredTryoutCountryKey,
      };
    });
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(listCurriculumPrograms),
  Layer.provide(getCurrent),
  Layer.provide(getCurrentTryout),
  GroupImpl.finalize
);
