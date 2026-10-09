import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import {
  readCurrentTryoutCountry,
  toTryoutCountryOption,
} from "@repo/backend/confect/learningPreferences/impl";
import {
  listCurriculumPrograms as listCurriculumProgramOptions,
  readCurrentCurriculumProgram,
} from "@repo/backend/confect/learningPreferences/program";
import spec from "@repo/backend/confect/learningPreferences/queries.spec";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer } from "effect";

const listCurriculumPrograms = FunctionImpl.make(
  databaseSchema,
  spec,
  "listCurriculumPrograms",
  Effect.fn("learningPreferences.queries.listCurriculumPrograms")(function* ({
    locale,
  }) {
    return yield* listCurriculumProgramOptions(locale);
  })
);
const getCurrent = FunctionImpl.make(
  databaseSchema,
  spec,
  "getCurrent",
  Effect.fn("learningPreferences.queries.getCurrent")(function* ({ locale }) {
    const user = yield* getOptionalAppUserForRead();
    if (!user) {
      return null;
    }
    return yield* readCurrentCurriculumProgram(locale, user.appUser._id);
  })
);
const getCurrentTryout = FunctionImpl.make(
  databaseSchema,
  spec,
  "getCurrentTryout",
  Effect.fn("learningPreferences.queries.getCurrentTryout")(function* (args) {
    const user = yield* getOptionalAppUserForRead();
    if (!user) {
      return null;
    }
    const preference = yield* readCurrentTryoutCountry({
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
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(listCurriculumPrograms),
  Layer.provide(getCurrent),
  Layer.provide(getCurrentTryout),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
