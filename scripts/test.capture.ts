import { Array as Arr, Ref, Sink } from "effect";

/** Creates the record of one captured standard stream: the chunks written to it. */
export const makeCapture = Ref.make<readonly (string | Uint8Array)[]>([]);

/** Returns the stream of a test Stdio layer that appends every written chunk to `chunks`. */
export function capture(chunks: Ref.Ref<readonly (string | Uint8Array)[]>) {
  return () =>
    Sink.forEachArray((written: readonly (string | Uint8Array)[]) =>
      Ref.update(chunks, Arr.appendAll(written))
    );
}
