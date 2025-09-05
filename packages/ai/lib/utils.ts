import type { UIDataTypes, UIMessagePart } from "ai";
import dedent from "dedent";
import { fromUrl, ParseResultType, parseDomain } from "parse-domain";
import { DEFAULT_LIMIT, isWithinLimit } from "./tokens";
import type { MyUIMessage, MyUITools } from "./types";

/**
 * Build a content slug
 * @param params - The parameters to build the slug
 * @returns The built slug
 */
export function buildContentSlug(params: {
  locale: string;
  filters: {
    type: "articles" | "subject";
    category?: string | null;
    grade?: string | null;
    material?: string | null;
  };
}): string {
  const { locale, filters } = params;
  const { type, category, grade, material } = filters;

  const segments: string[] = [locale, type];

  if (category) {
    segments.push(category);

    if (type === "subject" && grade) {
      segments.push(grade);

      if (material) {
        segments.push(material);
      }
    }
  }

  return segments.join("/");
}

/**
 * Clean a slug
 * @param slug - The slug to clean
 * @returns The cleaned slug
 */
export function cleanSlug(slug: string): string {
  // remove slash at the beginning and the end
  return slug.replace(/^\/+|\/+$/g, "");
}

/**
 * Dedent a string
 * @param text - The text to dedent
 * @returns The dedented text
 */
export function dedentString(text: string): string {
  return dedent(text);
}

/**
 * Extract the domain from a URL
 * @param url - The URL to extract the domain from
 * @returns The extracted domain
 */
export function extractDomain(url: string): string {
  const result = parseDomain(fromUrl(url));
  if (result.type === ParseResultType.Listed) {
    const { domain } = result;
    return domain || "";
  }
  return "";
}

/**
 * Extract content from a message part
 * @param part - The message part to extract content from
 * @returns The extracted content
 */
export function extractContentFromPart(
  part: UIMessagePart<UIDataTypes, MyUITools>
): string {
  // Extract content from different part types
  if (part.type === "text" || part.type === "reasoning") {
    return part.text || "";
  }
  if (part.type.startsWith("tool-") && "output" in part && part.output) {
    return typeof part.output === "string"
      ? part.output
      : JSON.stringify(part.output, null, 2);
  }
  if ("input" in part && part.input) {
    return typeof part.input === "string"
      ? part.input
      : JSON.stringify(part.input, null, 2);
  }
  return "";
}

/**
 * Smart message compression that removes old messages one by one until within token limit
 * Instead of slicing messages arbitrarily, this function preserves as much conversation history as possible
 * @param messages - Array of UI messages to compress
 * @param tokenLimit - Optional token limit (uses default from isWithinLimit if not provided)
 * @returns Object with compressed messages and token information
 */
export function compressMessages(
  messages: MyUIMessage[],
  tokenLimit?: number
): {
  messages: MyUIMessage[];
  tokens: string;
} {
  if (messages.length === 0) {
    return {
      messages,
      tokens: "0",
    };
  }

  // Helper function to get content from all messages
  const getMessagesContent = (msgs: MyUIMessage[]): string => {
    return msgs
      .flatMap((m) => m.parts.map(extractContentFromPart).filter(Boolean))
      .join("\n");
  };

  // Helper function to format token information
  const formatTokenInfo = (
    messageContent: string,
    tokenLimitOverride?: number
  ): string => {
    const tokenResult = isWithinLimit({
      content: messageContent,
      limit: tokenLimitOverride,
    });
    if (tokenResult === false) {
      const actualLimit = tokenLimitOverride ?? DEFAULT_LIMIT;
      return `more than ${actualLimit}`;
    }
    return tokenResult.toString();
  };

  // Start with all messages
  let workingMessages = [...messages];

  // Check if messages are already within limit
  const content = getMessagesContent(workingMessages);
  const tokenCheck = isWithinLimit({ content, limit: tokenLimit });

  if (tokenCheck !== false) {
    return {
      messages: workingMessages,
      tokens: tokenCheck.toString(),
    };
  }

  // Keep the last message (most recent) and work backwards
  // This ensures we always have at least the current user message and AI response
  const lastMessage = workingMessages.at(-1);
  if (!lastMessage) {
    return {
      messages: workingMessages,
      tokens: formatTokenInfo(content, tokenLimit),
    };
  }
  workingMessages = workingMessages.slice(0, -1); // Remove last message temporarily

  // Remove messages from the beginning (oldest first) until within limit
  while (workingMessages.length > 0) {
    // Test with current messages + last message
    const testMessages = [...workingMessages, lastMessage];
    const testContent = getMessagesContent(testMessages);
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

    // Remove the oldest message (first in array)
    workingMessages.shift();
  }

  // If even just the last message exceeds the limit, return only that
  // This is a fallback case for extremely large single messages
  const lastMessageContent = getMessagesContent([lastMessage]);
  return {
    messages: [lastMessage],
    tokens: formatTokenInfo(lastMessageContent, tokenLimit),
  };
}
