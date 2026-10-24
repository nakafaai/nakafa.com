import { Config, Effect, Record as Rec, Schema } from "effect";

/** Every bound value is a non-empty string. An unset value is absent, so it is never checked. */
const BoundValues = Schema.Record(Schema.String, Schema.NonEmptyString);

/**
 * Refuses a deploy before any Worker changes when a bound value is empty. GitHub
 * Actions passes an unset secret as an empty string. The error is the Config
 * error that the stack declares, and it names the binding without its value.
 */
export const requireNonEmptyBindings = Effect.fn(
  "deploy.requireNonEmptyBindings"
)(function* (environment: Readonly<Record<string, string | undefined>>) {
  yield* Schema.decodeEffect(BoundValues)(
    Rec.filter(environment, (value) => value !== undefined)
  ).pipe(Effect.mapError((cause) => new Config.ConfigError(cause)));
});
