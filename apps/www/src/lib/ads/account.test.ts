// @vitest-environment node

import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { AD_CLIENT } from "@/lib/ads/account";

/** Google's certification authority id, which every `ads.txt` line for Google ends with. */
const GOOGLE_AUTHORITY_ID = "f08c47fec0942fa0";

describe("ads.txt", () => {
  it.effect("authorizes exactly the account that serves the ads", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const file = yield* fs.readFileString(
        path.join(import.meta.dirname, "../../../public/ads.txt")
      );
      expect(file).toBe(
        `google.com, ${AD_CLIENT.replace("ca-", "")}, DIRECT, ${GOOGLE_AUTHORITY_ID}\n`
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
