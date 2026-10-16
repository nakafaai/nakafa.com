import { extractText, isTool } from "@convex-dev/agent";
import {
  type Message,
  type MessageDoc,
  type MessageWithMetadata,
  vMessage,
  vProviderMetadata,
  vReasoningDetails,
  vSource,
} from "@convex-dev/agent/validators";
import {
  SEALED_KEY,
  skeletonMessage,
} from "@repo/backend/confect/nina/sealed/skeleton";
import type { readLearnerKeys } from "@repo/backend/confect/vault/keys";
import type { VaultField } from "@repo/backend/confect/vault/schema";
import { VaultError } from "@repo/backend/confect/vault/schema";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import { encodeJsonText } from "@repo/utilities/json";
import { convexToJson, type JSONValue, jsonToConvex, v } from "convex/values";
import { parse } from "convex-helpers/validators";
import { Effect, Predicate, Record, Schema, Struct } from "effect";
import { Base64Url } from "effect/encoding";

/**
 * A message's place in its thread: the thread, and the order and the step of the
 * message there. Its sealed content opens only for this identity (ADR 0024).
 */
export const MessageIdentity = Schema.Struct({
  order: Schema.Finite,
  stepOrder: Schema.Finite,
  threadId: Schema.String,
});
export type MessageIdentity = typeof MessageIdentity.Type;

type LearnerKeys = Effect.Success<ReturnType<typeof readLearnerKeys>>;

/**
 * The stored field of one message's sealed content. The row is named by its
 * thread, its order and its step, so a payload copied to another row never opens.
 */
function messageField(identity: MessageIdentity) {
  return {
    field: "message",
    row: [identity.threadId, identity.order, identity.stepOrder],
    table: "ninaMessages",
  } satisfies typeof VaultField.Type;
}

/** A JSON value in the form `convexToJson` writes, which `jsonToConvex` reads back. */
const JsonValue: Schema.Codec<JSONValue> = Schema.Union([
  Schema.Null,
  Schema.Boolean,
  Schema.Finite,
  Schema.String,
  Schema.mutable(Schema.Array(Schema.suspend(() => JsonValue))),
  Schema.Record(
    Schema.String,
    Schema.suspend(() => JsonValue)
  ),
]);

/**
 * The content that is sealed: the message and the fields that the row keeps out
 * of the clear. Opening checks the value against this validator.
 */
const SealedContent = v.object({
  error: v.optional(v.string()),
  message: vMessage,
  providerMetadata: v.optional(vProviderMetadata),
  reasoning: v.optional(v.string()),
  reasoningDetails: v.optional(vReasoningDetails),
  sources: v.optional(v.array(vSource)),
});

/** The failure of sealed content that does not open. It reveals nothing about it. */
const cipherError = () => new VaultError({ reason: "cipher" });

/** The message without the sealed key, which no opened row may carry. */
function withoutSealed(message: Message): Message {
  const options = message.providerOptions;
  if (options === undefined) {
    return message;
  }
  return { ...message, providerOptions: Record.remove(options, SEALED_KEY) };
}

/**
 * Seals a message for the learner who owns its thread, and returns the row to
 * store: the fields that stay in the clear, and the skeleton of the message with
 * its sealed content in the provider options. The row must be stored under
 * `identity`, because the sealed content opens only for that identity.
 */
export const sealMessage = Effect.fn("nina.sealed.seal")(function* (
  keys: LearnerKeys,
  identity: MessageIdentity,
  row: MessageWithMetadata
) {
  const content = encodeJsonText(
    convexToJson(
      Struct.pick(row, [
        "error",
        "message",
        "providerMetadata",
        "reasoning",
        "reasoningDetails",
        "sources",
      ])
    )
  );
  const sealed = yield* sealText(keys, messageField(identity), content);
  return {
    ...Struct.pick(row, [
      "fileIds",
      "finishReason",
      "model",
      "provider",
      "status",
      "usage",
      "warnings",
    ]),
    message: skeletonMessage(
      row.message,
      Base64Url.encode(new Uint8Array(sealed))
    ),
  };
});

/** Opens the sealed content of one message for `identity`, and checks its shape. */
const openContent = Effect.fn("nina.sealed.openContent")(function* (
  keys: LearnerKeys,
  identity: MessageIdentity,
  sealed: string
) {
  const bytes = yield* Effect.fromResult(Base64Url.decode(sealed)).pipe(
    Effect.mapError(cipherError)
  );
  const text = yield* openText(
    keys,
    messageField(identity),
    new Uint8Array(bytes).buffer
  );
  const json = yield* Schema.decodeEffect(Schema.fromJsonString(JsonValue))(
    text
  ).pipe(Effect.mapError(cipherError));
  const value = yield* Effect.try({
    try: () => jsonToConvex(json),
    catch: cipherError,
  });
  return yield* Effect.try({
    try: () => parse(SealedContent, value),
    catch: cipherError,
  });
});

/**
 * Opens a stored message. A row with no sealed content is a plain row, and it is
 * returned as it is. A sealed row comes back as the message was written: its
 * content opened, its `text` and its `tool` derived the way the Agent derives
 * them, and no sealed key left. It fails with `VaultError` reason `cipher` when
 * the content does not open for these keys and this identity.
 */
export const openMessage = Effect.fn("nina.sealed.open")(function* (
  keys: LearnerKeys,
  identity: MessageIdentity,
  stored: MessageDoc
) {
  const sealedOptions = stored.message?.providerOptions?.[SEALED_KEY];
  if (sealedOptions === undefined) {
    return stored;
  }
  const sealed: unknown = sealedOptions.sealed;
  if (!Predicate.isString(sealed)) {
    return yield* cipherError();
  }
  const content = yield* openContent(keys, identity, sealed);
  return {
    ...Struct.omit(stored, [
      "error",
      "message",
      "providerMetadata",
      "reasoning",
      "reasoningDetails",
      "sources",
      "text",
      "tool",
    ]),
    ...content,
    message: withoutSealed(content.message),
    text: extractText(content.message),
    tool: isTool(content.message),
  };
});
