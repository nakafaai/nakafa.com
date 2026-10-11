import { describe, expect, it } from "@effect/vitest";
import {
  type DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  openSummary,
  sealSummary,
} from "@repo/backend/confect/nina/summaries/text";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { ensureLearnerKeys } from "@repo/backend/confect/vault/keys";
import { VaultError } from "@repo/backend/confect/vault/schema";
import { sealText } from "@repo/backend/confect/vault/text";
import { showsText } from "@repo/backend/test/seal";
import { Cause, Effect, Exit, Result } from "effect";

const SUMMARY = "- Pecahan, desimal, dan persen.";

/** Runs one scenario inside a mutation of a fresh deployment. */
const scenario = <A, Failure>(
  body: Effect.Effect<A, Failure, DatabaseReader | DatabaseWriter>
) =>
  Effect.gen(function* () {
    yield* (yield* Confect).run(body.pipe(Effect.orDie));
  }).pipe(Effect.provide(confectLayer));

/** Creates one account and returns its id. */
const learner = Effect.fn("test.summaries.text.learner")(function* (
  name: string
) {
  return yield* (yield* DatabaseWriter).table("users").insert({
    authId: `summary-${name}`,
    credits: 0,
    creditsResetAt: 0,
    email: `${name}@example.com`,
    name,
    plan: "free",
  });
});

describe("summary text", () => {
  it.effect(
    "seals a text so the stored bytes hold no text, and opens it for the chat owner",
    () =>
      scenario(
        Effect.gen(function* () {
          const owner = yield* learner("owner");
          const sealed = yield* sealSummary(owner, SUMMARY);
          expect(showsText(sealed, SUMMARY)).toBe(false);
          expect(yield* openSummary(owner, sealed)).toBe(SUMMARY);
        })
      )
  );

  it.effect("opens a plain text as it is without reading any key", () =>
    scenario(
      Effect.gen(function* () {
        // This learner has no key: reading it would fail.
        const keyless = yield* learner("keyless");
        expect(yield* openSummary(keyless, SUMMARY)).toBe(SUMMARY);
      })
    )
  );

  it.effect(
    "refuses to open a text with the keys of another learner or for another field",
    () =>
      scenario(
        Effect.gen(function* () {
          const owner = yield* learner("owner");
          const other = yield* learner("other");
          yield* ensureLearnerKeys(other);
          const sealed = yield* sealSummary(owner, SUMMARY);
          const stranger = yield* Effect.exit(openSummary(other, sealed));
          expect(Exit.isFailure(stranger)).toBe(true);
          if (Exit.isFailure(stranger)) {
            expect(Cause.findDefect(stranger.cause)).toEqual(
              Result.succeed(new VaultError({ reason: "cipher" }))
            );
          }
          const title = yield* sealText(
            yield* ensureLearnerKeys(owner),
            { field: "title", table: "chats" },
            SUMMARY
          );
          const moved = yield* Effect.exit(openSummary(owner, title));
          expect(Exit.isFailure(moved)).toBe(true);
        })
      )
  );
});
