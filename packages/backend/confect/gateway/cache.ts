import type { LanguageModelMiddleware } from "ai";
import { Array as Arr, Option } from "effect";

type Prompt = Parameters<
  NonNullable<LanguageModelMiddleware["transformParams"]>
>[0]["params"]["prompt"];
type Message = Prompt[number];

/**
 * The marker the gateway reads. Its adapter spreads `openaiCompatible` options
 * onto the request message or content part that carries them.
 */
const marker = { cache_control: { type: "ephemeral" } };

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
export function markCachedPrefix(prompt: Prompt): Prompt {
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
 * Asks the gateway to cache the prompt prefix. The Convex AI gateway caches
 * nothing without a marker: measured on 10 October 2026, a repeated prefix of
 * 53,624 tokens read zero cached tokens, and one marker made a repeat of 5,904
 * tokens read 5,894 from the cache. The provider keeps a prefix for about five
 * minutes and ignores one below about 4,000 tokens.
 */
export const cachedPrefix: LanguageModelMiddleware = {
  specificationVersion: "v4",
  transformParams: ({ params }) =>
    Promise.resolve({ ...params, prompt: markCachedPrefix(params.prompt) }),
};
