import { Effect, Schema } from "effect";
import type { Changes } from "@/e2e/support/changes";
import { START } from "@/e2e/support/chat";

/** The Convex names of the upload functions the composer calls. */
export const SAVE = "nina/uploads:save";
export const RELEASE = "nina/uploads:release";

/** The arguments of a call that releases one upload. */
const ReleaseArguments = Schema.Tuple([
  Schema.Struct({ uploadId: Schema.String }),
]);
/** The arguments of a call that starts a turn: the uploads it names. */
const StartArguments = Schema.Tuple([
  Schema.Struct({
    input: Schema.Struct({
      prompt: Schema.Struct({ uploadIds: Schema.Array(Schema.String) }),
    }),
  }),
]);

/** The uploads each call that started a turn named, in the order the calls were sent. */
export const uploadsNamedBy = (changes: Changes) =>
  Effect.forEach(changes.argumentsOf(START), (args) =>
    Schema.decodeUnknownEffect(StartArguments)(args).pipe(
      Effect.map(([argument]) => argument.input.prompt.uploadIds)
    )
  );

/** The uploads the page gave back, in the order it did. */
export const uploadsReleasedBy = (changes: Changes) =>
  Effect.forEach(changes.argumentsOf(RELEASE), (args) =>
    Schema.decodeUnknownEffect(ReleaseArguments)(args).pipe(
      Effect.map(([argument]) => argument.uploadId)
    )
  );
