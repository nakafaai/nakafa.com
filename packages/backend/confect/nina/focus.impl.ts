import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { readQuestionFocus } from "@repo/backend/confect/nina/focus";
import spec from "@repo/backend/confect/nina/focus.spec";
import { Effect, Layer } from "effect";

const read = FunctionImpl.make(
  schema,
  spec,
  "read",
  Effect.fn("nina.focus.readTurn")(function* ({ turnId }) {
    const turn = yield* (yield* DatabaseReader)
      .table("ninaTurns")
      .get(turnId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!turn?.page?.nina.focus) {
      return null;
    }
    // Admission verified this focus; a failed signed read is an integrity defect.
    return yield* readQuestionFocus(
      turn.page.nina.focus,
      turn.userId,
      turn.page.locale
    ).pipe(Effect.orDie);
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(read),
  GroupImpl.finalize
);
