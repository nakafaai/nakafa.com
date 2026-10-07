import { layer as WebCryptoLayer } from "@effect/platform-browser/BrowserCrypto";
import { Crypto, Effect } from "effect";

/**
 * Generates one random version 4 UUID through Effect's `Crypto` service.
 *
 * The Web Crypto layer serves every runtime Nakafa runs in: browsers, Node and
 * Convex. A runtime whose random source fails is a defect, not an expected
 * failure, so a caller that must recover catches the defect.
 */
export const randomUuid = Effect.gen(function* () {
  const crypto = yield* Crypto.Crypto;
  return yield* crypto.randomUUIDv4;
}).pipe(Effect.orDie, Effect.provide(WebCryptoLayer));
