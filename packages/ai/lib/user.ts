import type { ModelMessage, UserModelMessage } from "ai";

/**
 * Reads the latest user-authored text from AI SDK model messages.
 */
export function getLatestUserText(messages: ModelMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message.role !== "user") {
      continue;
    }

    return getUserMessageText(message);
  }

  return;
}

/**
 * Converts AI SDK user message text parts into one searchable text buffer.
 */
function getUserMessageText(message: UserModelMessage) {
  if (typeof message.content === "string") {
    return message.content;
  }

  return message.content
    .flatMap((part) => {
      if (part.type !== "text") {
        return [];
      }

      return [part.text];
    })
    .join(" ");
}
