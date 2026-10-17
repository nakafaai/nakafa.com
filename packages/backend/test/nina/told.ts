import { assert } from "@effect/vitest";
import { Array as Arr, Option, Schema } from "effect";

const PartKinds = Schema.Array(Schema.Struct({ type: Schema.String }));

/** The page of messages that a reader is told, with the role and the parts of each message. */
const Told = Schema.Struct({
  page: Schema.Array(
    Schema.Struct({ parts: Schema.Unknown, role: Schema.String })
  ),
});

/**
 * The kinds of the parts of the assistant's message in what a reader was told, in
 * order. `told` is the page that a read of the messages returns.
 */
export function kindsOf(told: typeof Told.Type) {
  const assistant = Arr.findFirst(
    told.page,
    ({ role }) => role === "assistant"
  );
  assert(Option.isSome(assistant));
  return Arr.map(
    Schema.decodeUnknownSync(PartKinds)(assistant.value.parts),
    ({ type }) => type
  );
}
