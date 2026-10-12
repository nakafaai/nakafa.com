import type { ModelMessage, UserModelMessage } from "ai";
import { Array as Arr, pipe } from "effect";

/**
 * Marks the text part that carries a turn's runtime facts. The gateway adapter
 * reads only its own option namespaces, so it ignores this one, and a learner
 * cannot write it: their prompt and uploads become plain parts.
 */
const TURN_CONTEXT = { nina: { turnContext: true } };

type UserPart = Exclude<UserModelMessage["content"], string>[number];

/** Whether one part is the runtime facts of a turn, not something the learner wrote. */
function isTurnContext(part: UserPart) {
  return (
    part.type === "text" && part.providerOptions?.nina?.turnContext === true
  );
}

/**
 * Puts the runtime facts of a turn in front of the learner's message, in the
 * same message. They are read together with it and never stored as if the
 * learner wrote them, and the cached prefix before the message does not change.
 */
export function withTurnContext(message: UserModelMessage, context: string) {
  return {
    ...message,
    content: [
      { type: "text" as const, text: context, providerOptions: TURN_CONTEXT },
      ...(typeof message.content === "string"
        ? [{ type: "text" as const, text: message.content }]
        : message.content),
    ],
  } satisfies UserModelMessage;
}

/**
 * Reads the latest user-authored text from AI SDK model messages. The runtime
 * facts of a turn are not the learner's words, so they are left out.
 */
export function getLatestUserText(messages: ModelMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message.role !== "user") {
      continue;
    }

    return getUserMessageText(message);
  }
}

/**
 * Converts AI SDK user message text parts into one searchable text buffer.
 */
function getUserMessageText(message: UserModelMessage) {
  if (typeof message.content === "string") {
    return message.content;
  }

  return pipe(
    message.content,
    Arr.flatMap((part) => {
      if (part.type !== "text" || isTurnContext(part)) {
        return [];
      }

      return [part.text];
    }),
    Arr.join(" ")
  );
}
