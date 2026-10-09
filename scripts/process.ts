import { type PlatformError, Stream } from "effect";

/** Collects one child-process stream as UTF-8 text. */
export function collectText(
  stream: Stream.Stream<Uint8Array, PlatformError.PlatformError>
) {
  return stream.pipe(
    Stream.decodeText(),
    Stream.runFold(
      () => "",
      (output, chunk) => output + chunk
    )
  );
}
