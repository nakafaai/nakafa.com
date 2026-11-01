import { Effect } from "effect";
import { SecureRandom } from "effect/crypto";

/**
 * Generates one random version 4 UUID through Effect's `SecureRandom` service.
 *
 * The Web Crypto layer serves every runtime Nakafa runs in: browsers, Node and
 * Convex. A runtime whose random source fails is a defect, not an expected
 * failure, so a caller that must recover catches the defect.
 */
export const randomUuid = Effect.gen(function* () {
  const random = yield* SecureRandom.SecureRandom;
  return yield* random.uuidV4();
}).pipe(Effect.provide(SecureRandom.layerWebCrypto));
