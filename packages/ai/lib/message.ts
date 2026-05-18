import { DEFAULT_LIMIT, isWithinLimit } from "@repo/ai/lib/tokens";
import type { MyUITools } from "@repo/ai/schema/tools";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIDataTypes, UIMessagePart } from "ai";

/**
 * Compresses old UI messages until the retained transcript fits the token limit.
 */
export function compressMessages(messages: MyUIMessage[], tokenLimit?: number) {
  if (messages.length === 0) {
    return {
      messages,
      tokens: "0",
    };
  }

  let retainedMessages = [...messages];
  const content = getMessagesText(retainedMessages);
  const tokenCheck = isWithinLimit({ content, limit: tokenLimit });

  if (tokenCheck !== false) {
    return {
      messages: retainedMessages,
      tokens: tokenCheck.toString(),
    };
  }

  const lastMessage = retainedMessages.at(-1);
  if (!lastMessage) {
    return {
      messages: retainedMessages,
      tokens: formatTokenInfo(content, tokenLimit),
    };
  }

  retainedMessages = retainedMessages.slice(0, -1);

  while (retainedMessages.length > 0) {
    const testMessages = [...retainedMessages, lastMessage];
    const testContent = getMessagesText(testMessages);
    const testTokenCheck = isWithinLimit({
      content: testContent,
      limit: tokenLimit,
    });

    if (testTokenCheck !== false) {
      return {
        messages: testMessages,
        tokens: testTokenCheck.toString(),
      };
    }

    retainedMessages.shift();
  }

  return {
    messages: [lastMessage],
    tokens: formatTokenInfo(getMessagesText([lastMessage]), tokenLimit),
  };
}

/**
 * Joins all searchable UI message content into one token-counting buffer.
 */
function getMessagesText(messages: MyUIMessage[]) {
  return messages
    .flatMap((message) => message.parts.map(getPartText).filter(Boolean))
    .join("\n");
}

/**
 * Reads the text payload from one UI message part.
 */
function getPartText(part: UIMessagePart<UIDataTypes, MyUITools>) {
  if (part.type === "text") {
    return part.text || "";
  }

  if (part.type.startsWith("tool-") && "output" in part && part.output) {
    if (typeof part.output === "string") {
      return part.output;
    }

    return JSON.stringify(part.output, null, 2);
  }

  if ("input" in part && part.input) {
    if (typeof part.input === "string") {
      return part.input;
    }

    return JSON.stringify(part.input, null, 2);
  }

  return "";
}

/**
 * Formats the token estimate shown in chat-route diagnostics.
 */
function formatTokenInfo(messageContent: string, tokenLimit?: number) {
  const tokenResult = isWithinLimit({
    content: messageContent,
    limit: tokenLimit,
  });

  if (tokenResult !== false) {
    return tokenResult.toString();
  }

  const actualLimit = tokenLimit ?? DEFAULT_LIMIT;
  return `more than ${actualLimit}`;
}
