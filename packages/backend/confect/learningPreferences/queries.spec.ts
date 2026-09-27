import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import {
  CurriculumPreferenceError,
  currentLearningPreferenceValidator,
  currentTryoutPreferenceValidator,
  curriculumProgramOptionValidator,
  LearningPreferencePersistenceError,
} from "@repo/backend/confect/learningPreferences/schema";
import { localeValidator } from "@repo/backend/confect/lib/validators/contents";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "listCurriculumPrograms",
      args: () => ({
        locale: localeValidator,
      }),
      returns: () =>
        Schema.mutable(Schema.Array(curriculumProgramOptionValidator)),
      error: () => Schema.Union([ReleaseError, CurriculumPreferenceError]),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getCurrent",
      args: () => ({
        locale: localeValidator,
      }),
      returns: () => currentLearningPreferenceValidator,
      error: () =>
        Schema.Union([
          LearningPreferencePersistenceError,
          CurriculumPreferenceError,
          ReleaseError,
        ]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getCurrentTryout",
      args: () => ({
        locale: localeValidator,
      }),
      returns: () => currentTryoutPreferenceValidator,
      error: () =>
        Schema.Union([LearningPreferencePersistenceError, ReleaseError]),
    }).middleware(Session)
  );
