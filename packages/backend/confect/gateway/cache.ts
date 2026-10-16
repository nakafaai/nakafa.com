import { languageModel } from "@repo/backend/confect/gateway/model";
import type { LanguageModelMiddleware } from "ai";
import { Array as Arr, Option } from "effect";

type Prompt = Parameters<
  NonNullable<LanguageModelMiddleware["transformParams"]>
>[0]["params"]["prompt"];
type Message = Prompt[number];

/**
 * The marker the gateway reads, from the language model profile. Its adapter
 * spreads `openaiCompatible` options onto the request message or content part
 * that carries them.
 */
const marker = languageModel.cache.marker;

/** Adds the marker to whatever provider options a message or part already has. */
function marked<Options extends Message["providerOptions"]>(options: Options) {
  return {
    ...options,
    openaiCompatible: { ...options?.openaiCompatible, ...marker },
  };
}

/** Marks the last content part of a user or tool message. */
function markLast<
  Part extends { providerOptions?: Message["providerOptions"] },
>(parts: readonly Part[]) {
  return Arr.map(parts, (part, index) =>
    index === parts.length - 1
      ? { ...part, providerOptions: marked(part.providerOptions) }
      : part
  );
}

/**
 * Marks one message as the end of the cached prefix. The adapter reads the
 * options of a system or assistant message from the message itself, and those
 * of a user or tool message from its content parts, so the marker goes on the
 * last part there.
 */
function markMessage(message: Message): Message {
  if (message.role === "system" || message.role === "assistant") {
    return { ...message, providerOptions: marked(message.providerOptions) };
  }
  if (message.role === "user") {
    return { ...message, content: markLast(message.content) };
  }
  return { ...message, content: markLast(message.content) };
}

/**
 * Marks the last message before the newest user message: everything up to it
 * repeats in every later step of the same turn, and in the next turn while the
 * provider still holds it. The newest user message is never marked, because a
 * marker there bills the whole prompt as a cache write that nothing reads.
 */
function markCachedPrefix(prompt: Prompt): Prompt {
  return Option.match(
    Arr.findLastIndex(prompt, (message) => message.role === "user"),
    {
      onNone: () => prompt,
      onSome: (turn) =>
        Arr.map(prompt, (message, index) =>
          index === turn - 1 ? markMessage(message) : message
        ),
    }
  );
}

/**
 * Asks the gateway to cache the prompt prefix. The gateway caches nothing
 * without the marker, and the measurements behind the marker and the smallest
 * cached prefix are in the language model profile.
 */
export const cachedPrefix: LanguageModelMiddleware = {
  specificationVersion: "v4",
  transformParams: ({ params }) =>
    Promise.resolve({ ...params, prompt: markCachedPrefix(params.prompt) }),
};
