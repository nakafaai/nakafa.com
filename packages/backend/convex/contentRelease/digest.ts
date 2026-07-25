import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

/** Converts deterministic digest bytes into lower-case hexadecimal. */
function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

/** Computes one SHA-256 identity through the Convex Web Crypto runtime. */
export const hashText = Effect.fn("contentRelease.hashText")(function* (
  label: string,
  source: string
) {
  const encoded = new TextEncoder().encode(source);
  const digest = yield* Effect.tryPromise({
    catch: () =>
      new ReleaseError({
        code: "CONTENT_RELEASE_INTEGRITY",
        message: `Unable to identify ${label}.`,
      }),
    try: () => crypto.subtle.digest("SHA-256", encoded),
  });
  return `sha256:${toHex(digest)}`;
});
