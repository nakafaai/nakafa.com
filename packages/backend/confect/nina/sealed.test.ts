import { docsToModelMessages, isTool, toUIMessages } from "@convex-dev/agent";
import {
  type Message,
  type MessageDoc,
  type MessageWithMetadata,
  vMessageWithMetadataInternal,
} from "@convex-dev/agent/validators";
import { describe, expect, it } from "@effect/vitest";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import {
  type MessageIdentity,
  openMessage,
  sealMessage,
} from "@repo/backend/confect/nina/sealed";
import {
  ensureLearnerKeys,
  readLearnerKeys,
} from "@repo/backend/confect/vault/keys";
import { sealText } from "@repo/backend/confect/vault/text";
import {
  answer,
  learnerTurn,
  MESSAGE_IDENTITY,
  plantedAnswer,
  storedRow,
  systemTurn,
  toolTurn,
} from "@repo/backend/test/nina/message";
import { learner, scenario } from "@repo/backend/test/owner";
import { bytes, GOLDEN_WRAPPED, goldenUser } from "@repo/backend/test/vault";
import { encodeJsonText } from "@repo/utilities/json";
import { convexToJson } from "convex/values";
import { validate } from "convex-helpers/validators";
import { Effect } from "effect";
import { Base64 } from "effect/encoding";

const IDENTITY = MESSAGE_IDENTITY;

/** The planted values start with `PLANT-`, so one search finds any of them. */
const PLANT = "PLANT-";

/** The learner's answer that the golden test opens. */
const goldenRow: MessageWithMetadata = {
  message: {
    content: [{ text: "Jawabannya 12.", type: "text" }],
    role: "assistant",
  },
  reasoning: "Pikirkan rumusnya dulu.",
};
/** `goldenRow` sealed at `IDENTITY` for the golden learner, as this module wrote it. */
const GOLDEN_SEALED_MESSAGE =
  "0135a56325ede616246c26ba9fdc53dab08003e15c442a417f46ee447995aa08ce378626c1de35c8f2fa7e1335c146001c4be54c33e9b419ed0ad7b75264f21983dcf9911df3df154d0243993510885a099b9ed85958f5c5bafabe97b79e43fd798619299aa33e540b72c573229a04015f489bfead10614935480d044ec0768f50b46fe16035e2783b6d9ec35cf892ed162af92eadf6ab";

/** The sealed bytes of a message. */
function sealedOf(message: Message): ArrayBuffer {
  return message.providerOptions?.nakafa?.sealed;
}

/** The same sealed bytes with their last byte changed. */
function tampered(sealed: ArrayBuffer) {
  const bytes = new Uint8Array(sealed.slice(0));
  const last = bytes.length - 1;
  bytes.set([((bytes[last] ?? 0) + 1) % 256], last);
  return bytes.buffer;
}

/** A row whose message carries `sealed` as its sealed content, under `identity`. */
function rowWith(message: Message, sealed: unknown, identity: MessageIdentity) {
  return storedRow(
    { message: { ...message, providerOptions: { nakafa: { sealed } } } },
    identity
  );
}

/**
 * Seals `text` under the message field of one row, with the binding written out
 * by hand. The positive control below checks it against the module's own binding.
 */
const sealRaw = Effect.fn("test.nina.sealed.raw")(function* (
  keys: Parameters<typeof sealText>[0],
  identity: MessageIdentity,
  text: string
) {
  return yield* sealText(
    keys,
    {
      field: "message",
      row: [identity.threadId, identity.order, identity.stepOrder],
      table: "ninaMessages",
    },
    text
  );
});

describe("sealed message", () => {
  it.effect(
    "opens every part kind and every sealed field of every role as it was written",
    () =>
      scenario(
        Effect.gen(function* () {
          const owner = yield* ensureLearnerKeys(yield* learner("owner"));
          for (const message of [
            learnerTurn,
            answer,
            toolTurn,
            systemTurn,
            plantedAnswer,
          ]) {
            const sealed = yield* sealMessage(owner, IDENTITY, message);
            const row = storedRow(sealed, IDENTITY);
            expect(row.tool).toBe(isTool(message.message));
            expect(yield* openMessage(owner, IDENTITY, row)).toEqual(
              storedRow(message, IDENTITY)
            );
          }
        })
      )
  );

  it.effect(
    "keeps the type, the tool names and ids, the media types and the provider references of each part, and nothing it says or links to",
    () =>
      scenario(
        Effect.gen(function* () {
          const owner = yield* ensureLearnerKeys(yield* learner("owner"));
          const sealedAnswer = yield* sealMessage(owner, IDENTITY, answer);
          expect(sealedAnswer.message.content).toEqual([
            { text: "", type: "text" },
            { text: "", type: "reasoning" },
            { mediaType: "image/png", type: "reasoning-file" },
            { mediaType: "image/png", type: "reasoning-file" },
            { data: "", type: "redacted-reasoning" },
            { kind: "provider-note", type: "custom" },
            {
              input: {},
              toolCallId: "call-1",
              toolName: "search",
              type: "tool-call",
            },
            { id: "src-1", sourceType: "url", type: "source", url: "" },
            {
              id: "src-2",
              mediaType: "application/pdf",
              sourceType: "document",
              title: "",
              type: "source",
            },
            {
              approvalId: "approval-1",
              toolCallId: "call-2",
              type: "tool-approval-request",
            },
          ]);
          const sealedLearner = yield* sealMessage(
            owner,
            IDENTITY,
            learnerTurn
          );
          expect(sealedLearner.message.content).toEqual([
            { text: "", type: "text" },
            { image: "", mediaType: "image/png", type: "image" },
            {
              image: { reference: { openai: "file-abc" }, type: "reference" },
              mediaType: undefined,
              type: "image",
            },
            { data: "", mediaType: "text/plain", type: "file" },
            { data: "", mediaType: "application/pdf", type: "file" },
            { data: "", mediaType: "application/pdf", type: "file" },
          ]);
          const sealedTool = yield* sealMessage(owner, IDENTITY, toolTurn);
          expect(sealedTool.message.content).toEqual([
            { toolCallId: "call-1", toolName: "search", type: "tool-result" },
            {
              approvalId: "approval-1",
              approved: false,
              type: "tool-approval-response",
            },
          ]);
        })
      )
  );

  it.effect(
    "gives a row that the component's own addMessages validator accepts",
    () =>
      scenario(
        Effect.gen(function* () {
          const owner = yield* ensureLearnerKeys(yield* learner("owner"));
          for (const message of [
            learnerTurn,
            answer,
            toolTurn,
            systemTurn,
            plantedAnswer,
          ]) {
            const sealed = yield* sealMessage(owner, IDENTITY, message);
            expect(validate(vMessageWithMetadataInternal, sealed)).toBe(true);
          }
        })
      )
  );

  it.effect(
    "leaves no planted string in the stored row, and opens the planted text back",
    () =>
      scenario(
        Effect.gen(function* () {
          const owner = yield* ensureLearnerKeys(yield* learner("owner"));
          for (const message of [learnerTurn, plantedAnswer, toolTurn]) {
            const sealed = yield* sealMessage(owner, IDENTITY, message);
            const row = storedRow(sealed, IDENTITY);
            expect(encodeJsonText([sealed, row])).not.toContain(PLANT);
          }
          const row = storedRow(
            yield* sealMessage(owner, IDENTITY, plantedAnswer),
            IDENTITY
          );
          expect(
            encodeJsonText(yield* openMessage(owner, IDENTITY, row))
          ).toContain("PLANT-TEXT");
        })
      )
  );

  it.effect("opens a plain row as itself", () =>
    scenario(
      Effect.gen(function* () {
        const owner = yield* ensureLearnerKeys(yield* learner("owner"));
        const plain = storedRow(
          {
            message: {
              content: [{ text: "Biasa.", type: "text" }],
              role: "assistant",
            },
          },
          IDENTITY
        );
        expect(yield* openMessage(owner, IDENTITY, plain)).toBe(plain);
        const withoutMessage = { ...plain, message: undefined };
        expect(yield* openMessage(owner, IDENTITY, withoutMessage)).toBe(
          withoutMessage
        );
      })
    )
  );

  it.effect(
    "opens a sealed message only for its own thread, order, step and learner",
    () =>
      scenario(
        Effect.gen(function* () {
          const owner = yield* ensureLearnerKeys(yield* learner("owner"));
          const other = yield* ensureLearnerKeys(yield* learner("other"));
          const sealed = yield* sealMessage(owner, IDENTITY, answer);
          const row = storedRow(sealed, IDENTITY);
          const reason = (
            keys: Parameters<typeof openMessage>[0],
            identity: MessageIdentity,
            stored: MessageDoc
          ) =>
            Effect.flip(openMessage(keys, identity, stored)).pipe(
              Effect.map((failure) => failure.reason)
            );
          expect(
            yield* reason(owner, { ...IDENTITY, threadId: "thread-b" }, row)
          ).toBe("cipher");
          expect(yield* reason(owner, { ...IDENTITY, order: 5 }, row)).toBe(
            "cipher"
          );
          expect(yield* reason(owner, { ...IDENTITY, stepOrder: 3 }, row)).toBe(
            "cipher"
          );
          expect(yield* reason(other, IDENTITY, row)).toBe("cipher");
          // The same sealed content, copied into another row or another thread.
          const copiedToRow = storedRow(sealed, { ...IDENTITY, order: 9 });
          expect(
            yield* reason(owner, { ...IDENTITY, order: 9 }, copiedToRow)
          ).toBe("cipher");
          const copiedToThread = storedRow(sealed, {
            ...IDENTITY,
            threadId: "thread-b",
          });
          expect(
            yield* reason(
              owner,
              { ...IDENTITY, threadId: "thread-b" },
              copiedToThread
            )
          ).toBe("cipher");
          expect(yield* openMessage(owner, IDENTITY, row)).toMatchObject({
            text: "Jawabannya 12.",
          });
        })
      )
  );

  it.effect(
    "gives the component's readers an opened row with neither the payload nor the nakafa key",
    () =>
      scenario(
        Effect.gen(function* () {
          const owner = yield* ensureLearnerKeys(yield* learner("owner"));
          const sealed = yield* sealMessage(owner, IDENTITY, plantedAnswer);
          const sealedBytes = sealedOf(sealed.message);
          const opened = yield* openMessage(
            owner,
            IDENTITY,
            storedRow(sealed, IDENTITY)
          );
          const readers = encodeJsonText([
            docsToModelMessages([opened]),
            toUIMessages([opened]),
          ]);
          expect(readers).toContain("PLANT-TEXT");
          expect(readers).not.toContain("nakafa");
          expect(readers).not.toContain(
            Base64.encode(new Uint8Array(sealedBytes))
          );
        })
      )
  );

  it.effect(
    "removes a nakafa provider option that the message itself carries, on open",
    () =>
      scenario(
        Effect.gen(function* () {
          const owner = yield* ensureLearnerKeys(yield* learner("owner"));
          const own: MessageWithMetadata = {
            message: {
              content: [{ text: "Dengan opsi sendiri.", type: "text" }],
              providerOptions: { nakafa: { own: true }, other: { kept: 1 } },
              role: "assistant",
            },
          };
          const opened = yield* openMessage(
            owner,
            IDENTITY,
            storedRow(yield* sealMessage(owner, IDENTITY, own), IDENTITY)
          );
          expect(opened.message?.providerOptions).toEqual({
            other: { kept: 1 },
          });
        })
      )
  );

  it.effect(
    "fails with a cipher error for damaged or foreign sealed content, never with an empty message",
    () =>
      scenario(
        Effect.gen(function* () {
          const owner = yield* ensureLearnerKeys(yield* learner("owner"));
          const skeleton = (yield* sealMessage(owner, IDENTITY, answer))
            .message;
          const damaged = [
            rowWith(skeleton, "ATWlYyXt", IDENTITY),
            rowWith(skeleton, 7, IDENTITY),
            rowWith(skeleton, tampered(sealedOf(skeleton)), IDENTITY),
            rowWith(
              skeleton,
              yield* sealRaw(owner, IDENTITY, "bukan json"),
              IDENTITY
            ),
            rowWith(
              skeleton,
              yield* sealRaw(owner, IDENTITY, encodeJsonText({ note: "x" })),
              IDENTITY
            ),
            rowWith(
              skeleton,
              yield* sealRaw(
                owner,
                IDENTITY,
                encodeJsonText({ $integer: "!" })
              ),
              IDENTITY
            ),
          ];
          for (const row of damaged) {
            const failure = yield* Effect.flip(
              openMessage(owner, IDENTITY, row)
            );
            expect(failure._tag).toBe("VaultError");
            expect(failure.reason).toBe("cipher");
          }
        })
      )
  );

  it.effect("opens raw content sealed under the module's own field", () =>
    scenario(
      Effect.gen(function* () {
        const owner = yield* ensureLearnerKeys(yield* learner("owner"));
        const raw = yield* sealRaw(
          owner,
          IDENTITY,
          encodeJsonText(
            convexToJson({ message: { content: "Mentah.", role: "system" } })
          )
        );
        expect(
          yield* openMessage(
            owner,
            IDENTITY,
            rowWith({ content: "", role: "system" }, raw, IDENTITY)
          )
        ).toMatchObject({ message: { content: "Mentah.", role: "system" } });
      })
    )
  );

  it.effect(
    "keeps a field that the row holds in the clear, and fails when the sealed content holds it too",
    () =>
      scenario(
        Effect.gen(function* () {
          const owner = yield* ensureLearnerKeys(yield* learner("owner"));
          // A cut-off turn writes its status and error onto a prompt row after it is sealed (journal.ts).
          const prompt = storedRow(
            yield* sealMessage(owner, IDENTITY, learnerTurn),
            IDENTITY
          );
          expect(
            yield* openMessage(owner, IDENTITY, {
              ...prompt,
              error: "failed",
              status: "failed",
            })
          ).toMatchObject({ error: "failed", status: "failed" });
          expect(
            yield* openMessage(owner, IDENTITY, {
              ...prompt,
              reasoning: "Dicek ulang.",
            })
          ).toMatchObject({ reasoning: "Dicek ulang." });
          const both = {
            ...storedRow(
              yield* sealMessage(owner, IDENTITY, plantedAnswer),
              IDENTITY
            ),
            error: "cancelled",
          };
          const failure = yield* Effect.flip(
            openMessage(owner, IDENTITY, both)
          );
          expect(failure.reason).toBe("cipher");
        })
      )
  );
});

describe("sealed message stored form", () => {
  // The golden bytes were sealed for the learner of test/vault.ts by this module.
  // They open only under its field binding and its content format (ADR 0024), so a
  // change to either would strand every sealed message.
  it.effect("opens a sealed message as its stored form was written", () =>
    scenario(
      Effect.gen(function* () {
        yield* (yield* DatabaseWriter).table("vaultKeys").insert({
          createdAt: 1,
          root: "test",
          userId: goldenUser,
          wrapped: bytes(GOLDEN_WRAPPED),
        });
        const keys = yield* readLearnerKeys(goldenUser);
        const stored = storedRow(
          {
            message: {
              content: "",
              providerOptions: {
                nakafa: { sealed: bytes(GOLDEN_SEALED_MESSAGE) },
              },
              role: "assistant",
            },
          },
          IDENTITY
        );
        expect(yield* openMessage(keys, IDENTITY, stored)).toEqual(
          storedRow(goldenRow, IDENTITY)
        );
      })
    )
  );
});
