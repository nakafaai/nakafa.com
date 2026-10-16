import { extractText, isTool } from "@convex-dev/agent";
import type {
  MessageDoc,
  MessageWithMetadata,
} from "@convex-dev/agent/validators";
import type { MessageIdentity } from "@repo/backend/confect/nina/sealed";

/** The place of every fixture message: one thread, one order and one step. */
export const MESSAGE_IDENTITY = {
  order: 4,
  stepOrder: 2,
  threadId: "thread-a",
} satisfies MessageIdentity;

/** A learner turn with text, images and files. Its file names and addresses must stay sealed. */
export const learnerTurn: MessageWithMetadata = {
  fileIds: ["file-1"],
  message: {
    content: [
      { text: "Bantu saya soal ini.", type: "text" },
      {
        image: "https://files.example.com/PLANT-soal.png",
        mediaType: "image/png",
        type: "image",
      },
      {
        image: { reference: { openai: "file-abc" }, type: "reference" },
        type: "image",
      },
      {
        data: new TextEncoder().encode("bytes").buffer,
        filename: "PLANT-FILE-NAME.txt",
        mediaType: "text/plain",
        type: "file",
      },
      {
        data: "aGVsbG8=",
        filename: "PLANT-FILE-NAME.pdf",
        mediaType: "application/pdf",
        type: "file",
      },
      {
        data: "https://files.example.com/PLANT-modul.pdf",
        mediaType: "application/pdf",
        type: "file",
      },
    ],
    role: "user",
  },
  status: "success",
};

/** An answer with every kind of assistant part, and every field a row keeps beside its content. */
export const answer: MessageWithMetadata = {
  finishReason: "stop",
  message: {
    content: [
      { text: "Jawabannya 12.", type: "text" },
      { text: "Pikirkan rumusnya dulu.", type: "reasoning" },
      {
        mediaType: "image/png",
        type: "reasoning-file",
        url: "https://files.example.com/sketsa.png",
      },
      { mediaType: "image/png", type: "reasoning-file" },
      { data: "opaque-reasoning", type: "redacted-reasoning" },
      { kind: "provider-note", type: "custom" },
      {
        input: { query: "rumus luas" },
        toolCallId: "call-1",
        toolName: "search",
        type: "tool-call",
      },
      {
        id: "src-1",
        sourceType: "url",
        title: "Modul",
        type: "source",
        url: "https://example.com/modul",
      },
      {
        id: "src-2",
        mediaType: "application/pdf",
        sourceType: "document",
        title: "Berkas",
        type: "source",
      },
      {
        approvalId: "approval-1",
        toolCallId: "call-2",
        type: "tool-approval-request",
      },
    ],
    role: "assistant",
  },
  model: "claude-haiku-5-5",
  provider: "anthropic",
  providerMetadata: { anthropic: { cacheHit: true } },
  reasoning: "Pikirkan rumusnya dulu.",
  reasoningDetails: [{ text: "Pikirkan rumusnya dulu.", type: "text" }],
  sources: [
    {
      id: "src-1",
      sourceType: "url",
      title: "Modul",
      type: "source",
      url: "https://example.com/modul",
    },
  ],
  status: "success",
  usage: { totalTokens: 42 },
  warnings: [{ message: "Contoh peringatan.", type: "other" }],
};

/** A tool turn: a tool result and a tool approval that the learner refused. */
export const toolTurn: MessageWithMetadata = {
  message: {
    content: [
      {
        output: { type: "text", value: "Luas = p x l" },
        toolCallId: "call-1",
        toolName: "search",
        type: "tool-result",
      },
      {
        approvalId: "approval-1",
        approved: false,
        reason: "PLANT-REASON",
        type: "tool-approval-response",
      },
    ],
    role: "tool",
  },
};

/** The system prompt, which is one string. */
export const systemTurn: MessageWithMetadata = {
  message: { content: "Kamu adalah Nina.", role: "system" },
};

/** An answer with a planted string in every place that must stay sealed. */
export const plantedAnswer: MessageWithMetadata = {
  error: "PLANT-ERROR",
  message: {
    content: [
      { text: "PLANT-TEXT", type: "text" },
      { text: "PLANT-REASONING-PART", type: "reasoning" },
      {
        input: { query: "PLANT-INPUT" },
        toolCallId: "call-1",
        toolName: "search",
        type: "tool-call",
      },
      { data: "PLANT-INLINE", mediaType: "text/plain", type: "file" },
      {
        data: "https://files.example.com/PLANT-MODUL.pdf",
        mediaType: "application/pdf",
        type: "file",
      },
      {
        mediaType: "image/png",
        type: "reasoning-file",
        url: "https://files.example.com/PLANT-SKETCH.png",
      },
      {
        id: "src-1",
        sourceType: "url",
        title: "PLANT-TITLE",
        type: "source",
        url: "https://example.com/PLANT-URL",
      },
    ],
    role: "assistant",
  },
  providerMetadata: { provider: { note: "PLANT-METADATA" } },
  reasoning: "PLANT-REASONING-FIELD",
  reasoningDetails: [{ text: "PLANT-DETAIL", type: "text" }],
  sources: [
    {
      id: "src-2",
      sourceType: "url",
      title: "PLANT-SOURCE",
      type: "source",
      url: "https://example.com/PLANT-SOURCE",
    },
  ],
};

/** The row that the Agent component keeps for a message, with the fields it derives on write. */
export function storedRow(
  message: MessageWithMetadata,
  identity: MessageIdentity
): MessageDoc {
  return {
    ...message,
    _creationTime: 1,
    _id: "messageRow",
    order: identity.order,
    status: message.status ?? "success",
    stepOrder: identity.stepOrder,
    text: extractText(message.message),
    threadId: identity.threadId,
    tool: isTool(message.message),
  };
}
