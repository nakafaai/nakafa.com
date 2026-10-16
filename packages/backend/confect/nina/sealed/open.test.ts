import { beforeEach, describe, expect, it } from "@effect/vitest";
import { sealMessage } from "@repo/backend/confect/nina/sealed";
import { openRow, openRows } from "@repo/backend/confect/nina/sealed/open";
import {
  ensureLearnerKeys,
  readLearnerKeys,
} from "@repo/backend/confect/vault/keys";
import {
  answer,
  MESSAGE_IDENTITY,
  plantedAnswer,
  storedRow,
} from "@repo/backend/test/nina/message";
import { learner, scenario } from "@repo/backend/test/owner";
import { Effect } from "effect";

vi.mock("@repo/backend/confect/vault/keys", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@repo/backend/confect/vault/keys")>();
  return { ...actual, readLearnerKeys: vi.fn(actual.readLearnerKeys) };
});

const IDENTITY = MESSAGE_IDENTITY;
const LATER = { ...IDENTITY, stepOrder: 3 };

describe("opening a read of rows", () => {
  beforeEach(() => {
    vi.mocked(readLearnerKeys).mockClear();
  });

  it.effect(
    "reads no key for a page of plain rows, so a learner without a key reads them",
    () =>
      scenario(
        Effect.gen(function* () {
          const owner = yield* learner("owner");
          const plain = storedRow(
            {
              message: {
                content: [{ text: "Biasa.", type: "text" }],
                role: "assistant",
              },
            },
            IDENTITY
          );
          expect(yield* openRows(owner, [plain])).toEqual([plain]);
          expect(readLearnerKeys).not.toHaveBeenCalled();
        })
      )
  );

  it.effect(
    "reads the owner's key once for a page with sealed rows, and opens each row under its own place",
    () =>
      scenario(
        Effect.gen(function* () {
          const owner = yield* learner("owner");
          const keys = yield* ensureLearnerKeys(owner);
          const first = storedRow(
            yield* sealMessage(keys, IDENTITY, answer),
            IDENTITY
          );
          const second = storedRow(
            yield* sealMessage(keys, LATER, plantedAnswer),
            LATER
          );
          const plain = storedRow(
            { message: { content: "Biasa.", role: "system" } },
            { ...IDENTITY, order: 9 }
          );
          expect(yield* openRows(owner, [first, plain, second])).toEqual([
            storedRow(answer, IDENTITY),
            plain,
            storedRow(plantedAnswer, LATER),
          ]);
          expect(readLearnerKeys).toHaveBeenCalledTimes(1);
        })
      )
  );

  it.effect(
    "fails with reason key when the owner of a sealed row has no key",
    () =>
      scenario(
        Effect.gen(function* () {
          const author = yield* learner("author");
          const keys = yield* ensureLearnerKeys(author);
          const sealed = storedRow(
            yield* sealMessage(keys, IDENTITY, answer),
            IDENTITY
          );
          const stranger = yield* learner("stranger");
          const failure = yield* Effect.flip(openRows(stranger, [sealed]));
          expect(failure.reason).toBe("key");
        })
      )
  );

  it.effect("reads no key for one plain row, which is returned as it is", () =>
    scenario(
      Effect.gen(function* () {
        const owner = yield* learner("owner");
        const plain = storedRow(
          { message: { content: "Biasa.", role: "system" } },
          IDENTITY
        );
        expect(yield* openRow(owner, plain)).toEqual(plain);
        expect(readLearnerKeys).not.toHaveBeenCalled();
      })
    )
  );

  it.effect(
    "reads the owner's key for one sealed row and opens it under its own place",
    () =>
      scenario(
        Effect.gen(function* () {
          const owner = yield* learner("owner");
          const keys = yield* ensureLearnerKeys(owner);
          const sealed = storedRow(
            yield* sealMessage(keys, IDENTITY, answer),
            IDENTITY
          );
          expect(yield* openRow(owner, sealed)).toEqual(
            storedRow(answer, IDENTITY)
          );
          expect(readLearnerKeys).toHaveBeenCalledTimes(1);
        })
      )
  );
});
