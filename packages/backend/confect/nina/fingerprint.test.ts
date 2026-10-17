import { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { resolveNinaContext } from "@repo/backend/confect/nina/context";
import { requestFingerprint } from "@repo/backend/confect/nina/fingerprint";
import type { NinaInput } from "@repo/backend/confect/nina/turns.spec";
import { ensureLearnerKeys } from "@repo/backend/confect/vault/keys";
import {
  args,
  contextFor,
  fixture,
  start,
} from "@repo/backend/test/nina/admission";
import {
  fingerprintsIn,
  unkeyedFingerprint,
} from "@repo/backend/test/nina/sealed";
import { learner, scenario } from "@repo/backend/test/owner";
import { Effect } from "effect";

vi.mock("@repo/backend/confect/nina/context", () => ({
  resolveNinaContext: vi.fn(),
}));

const input = {
  kind: "message",
  page: { locale: "en", slug: "home" },
  prompt: { text: "Jelaskan limit fungsi." },
} satisfies typeof NinaInput.Type;

describe("request fingerprint", () => {
  it.effect(
    "gives a repeated request the same value, and another request another value",
    () =>
      scenario(
        Effect.gen(function* () {
          const keys = yield* ensureLearnerKeys(yield* learner("owner"));
          const first = yield* requestFingerprint(keys, null, input);

          expect(yield* requestFingerprint(keys, null, input)).toBe(first);
          expect(yield* requestFingerprint(keys, "chat-2", input)).not.toBe(
            first
          );
          expect(
            yield* requestFingerprint(keys, null, {
              ...input,
              prompt: { text: "Jelaskan turunan." },
            })
          ).not.toBe(first);
        })
      )
  );

  it.effect(
    "gives another learner's key another value for the same request",
    () =>
      scenario(
        Effect.gen(function* () {
          const owner = yield* ensureLearnerKeys(yield* learner("owner"));
          const other = yield* ensureLearnerKeys(yield* learner("other"));

          expect(yield* requestFingerprint(other, null, input)).not.toBe(
            yield* requestFingerprint(owner, null, input)
          );
        })
      )
  );

  it.effect(
    "is not the unkeyed fingerprint of the request, which a guessed message would confirm",
    () =>
      scenario(
        Effect.gen(function* () {
          const keys = yield* ensureLearnerKeys(yield* learner("owner"));
          const keyed = yield* requestFingerprint(keys, null, input);
          const unkeyed = yield* unkeyedFingerprint(null, input);

          // The same length, so only the key tells the two apart.
          expect(unkeyed).toHaveLength(keyed.length);
          expect(keyed).not.toBe(unkeyed);
        })
      )
  );
});

describe("the request fingerprint of an admission", () => {
  it("stores the keyed fingerprint of the request, which an unkeyed hash of the request does not match", async () => {
    vi.mocked(resolveNinaContext).mockReturnValue(contextFor("home"));
    const { t, identity, owner } = await fixture();
    const receipt = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await owner.mutation(start, args)
    );
    const turn = await t.query((ctx) =>
      ctx.db.get("ninaTurns", receipt.turnId)
    );
    const { keyed, unkeyed } = await fingerprintsIn(
      t,
      identity.userId,
      args.input
    );

    expect(turn?.fingerprint).toBe(keyed);
    expect(turn?.fingerprint).not.toBe(unkeyed);
  });
});
