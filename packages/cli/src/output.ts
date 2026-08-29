import { Effect, Schema, Stdio, Stream } from "effect";

const CompactJsonSchema = Schema.fromJsonString(Schema.Json);
const PrettyJsonSchema = Schema.fromJsonString(Schema.Json, { space: 2 });

/** Encodes validated JSON and writes it through the selected Effect stdio sink. */
export const writeJson = Effect.fn("NakafaCli.writeJson")(function* (
  output: "stderr" | "stdout",
  value: Schema.Json,
  pretty: boolean
) {
  const schema = pretty ? PrettyJsonSchema : CompactJsonSchema;
  const json = yield* Schema.encodeEffect(schema)(value).pipe(Effect.orDie);
  const stdio = yield* Stdio.Stdio;
  yield* Stream.make(`${json}\n`).pipe(Stream.run(stdio[output]()));
});
