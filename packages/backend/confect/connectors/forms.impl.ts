import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { requireAuth } from "@repo/backend/confect/auth/session";
import spec from "@repo/backend/confect/connectors/forms.spec";
import { readForm } from "@repo/backend/confect/connectors/google/forms";
import { ownDriveAccess } from "@repo/backend/confect/connectors/google/grant";
import { MAX_IMPORTED_QUESTIONS } from "@repo/backend/confect/exams/import";
import session from "@repo/backend/confect/middleware/session.impl";
import { FetchClient } from "@repo/utilities/http/client";
import { Array as Arr, Effect, Layer, Option } from "effect";

/** The questions of one picked form, as many as one placement takes. */
const questions = FunctionImpl.make(
  databaseSchema,
  spec,
  "questions",
  Effect.fn("connectors.forms.questions")(function* ({ formId }) {
    const { appUser } = yield* requireAuth();
    const access = yield* ownDriveAccess(appUser._id);
    if (Option.isNone(access)) {
      return null;
    }
    const placed = yield* readForm(access.value, formId).pipe(
      Effect.provide(FetchClient)
    );
    return Arr.take(placed, MAX_IMPORTED_QUESTIONS);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(questions),
  Layer.provide(session),
  GroupImpl.finalize
);
