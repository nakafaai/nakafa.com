import { sha256Hex } from "@repo/utilities/digest";
import { Effect, Schema } from "effect";

/** The input of a server function call as JSON text, in the order its loader wrote it. */
const InputJson = Schema.fromJsonString(Schema.Unknown);

/**
 * The key of the static file that holds the answer of one server function call:
 * the SHA-256 digest of the function's address and its input. The Worker that
 * records the call and the browser that reads it compute it alike, from the same
 * loader code. A runtime whose digest fails is a defect.
 */
export const staticCallKey = Effect.fn("www.static.callKey")(function* (
  url: string,
  data: unknown
) {
  const input = yield* Schema.encodeEffect(InputJson)(data);
  return yield* sha256Hex(`${url}\n${input}`);
}, Effect.orDie);
