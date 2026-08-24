import { Effect, Schema, Stdio, Stream } from "effect";

/** Expected failure while writing repository maintenance output. */
export class RepositoryOutputError extends Schema.TaggedError<RepositoryOutputError>()(
  "RepositoryOutputError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Writes one repository maintenance message to standard output. */
export const writeOutput = Effect.fn("RepositoryPolicy.writeOutput")(
  (value: string) =>
    Effect.flatMap(Stdio.Stdio, (stdio) =>
      Stream.succeed(value).pipe(Stream.run(stdio.stdout()))
    ).pipe(
      Effect.mapError(
        (cause) =>
          new RepositoryOutputError({
            cause,
            message: "Unable to write repository policy output.",
          })
      )
    )
);

/** Writes one repository maintenance message to standard error. */
export const writeError = Effect.fn("RepositoryPolicy.writeError")(
  (value: string) =>
    Effect.flatMap(Stdio.Stdio, (stdio) =>
      Stream.succeed(value).pipe(Stream.run(stdio.stderr()))
    ).pipe(
      Effect.mapError(
        (cause) =>
          new RepositoryOutputError({
            cause,
            message: "Unable to write repository policy errors.",
          })
      )
    )
);
