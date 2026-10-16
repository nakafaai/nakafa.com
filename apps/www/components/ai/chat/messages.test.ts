import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import { Schema } from "effect";
import {
  draftMessage,
  hasFailedReply,
  hasReply,
  mergeMessages,
  openingMessage,
} from "@/components/ai/chat/messages";

const chatId = Schema.decodeUnknownSync(Id("chats"))("chat_1");
const opening = {
  prompt: {
    files: [
      {
        filename: "graph.png",
        mediaType: "image/png",
        type: "file",
        url: "https://files.example/graph.png",
      },
      {
        mediaType: "application/pdf",
        type: "file",
        url: "https://files.example/notes.pdf",
      },
    ],
    text: "What is a limit?",
  },
  receipt: {
    chatId,
    order: 0,
    prompt: { files: [], text: "What is a limit?" },
    promptMessageId: "message_0",
    threadId: "thread_1",
    turnId: Schema.decodeUnknownSync(Id("ninaTurns"))("turn_1"),
  },
  submittedAt: 1700,
} satisfies Parameters<typeof openingMessage>[0];

/** One message of the transcript with the fields a test cares about. */
function message(
  order: number,
  role: NinaMessage["role"],
  status: NinaMessage["status"] = "success"
): NinaMessage {
  return {
    _creationTime: order,
    id: `${role}_${order}`,
    key: `thread_1-${order}-0`,
    order,
    parts: [],
    role,
    status,
    stepOrder: 0,
    text: "",
  };
}

const draft = draftMessage({
  chatId,
  createdAt: 2000,
  prompt: { text: "And a derivative?" },
  threadId: "thread_1",
  turnOrder: 1,
});

describe("chat/messages", () => {
  describe("openingMessage", () => {
    it("builds the saved prompt of a chat from its receipt", () => {
      expect(openingMessage(opening)).toEqual({
        _creationTime: 1700,
        id: "message_0",
        key: "thread_1-0-0",
        order: 0,
        parts: [
          { text: "What is a limit?", type: "text" },
          {
            filename: "graph.png",
            mediaType: "image/png",
            type: "file",
            url: "https://files.example/graph.png",
          },
          {
            mediaType: "application/pdf",
            type: "file",
            url: "https://files.example/notes.pdf",
          },
        ],
        role: "user",
        status: "success",
        stepOrder: 0,
        text: "What is a limit?",
      });
    });
  });

  describe("draftMessage", () => {
    it("builds a pending prompt under the key its saved message will have", () => {
      expect(draft).toEqual({
        _creationTime: 2000,
        id: "draft-chat_1",
        key: "thread_1-2-0",
        order: 2,
        parts: [{ text: "And a derivative?", type: "text" }],
        role: "user",
        status: "pending",
        stepOrder: 0,
        text: "And a derivative?",
      });
    });

    it("takes the first order for a chat without a turn", () => {
      const first = draftMessage({
        chatId,
        createdAt: 2000,
        prompt: { text: "Hello" },
        threadId: "thread_1",
        turnOrder: undefined,
      });

      expect(first).toMatchObject({ key: "thread_1-0-0", order: 0 });
    });

    it("shows each attachment by its preview and its original name, and keeps the id of its file", () => {
      const file = new File(["bytes"], "graph.png", { type: "image/png" });

      const withFile = draftMessage({
        chatId,
        createdAt: 2000,
        prompt: {
          files: [
            {
              file,
              id: "file_1",
              mediaType: "image/png",
              type: "file",
              url: "blob:graph",
            },
          ],
          text: "Check this",
        },
        threadId: "thread_1",
        turnOrder: 1,
      });

      expect(withFile.parts).toEqual([
        { text: "Check this", type: "text" },
        {
          filename: "graph.png",
          id: "file_1",
          mediaType: "image/png",
          type: "file",
          url: "blob:graph",
        },
      ]);
    });
  });

  describe("mergeMessages", () => {
    const saved = [message(0, "user"), message(0, "assistant")];

    it("shows the saved messages once they have loaded", () => {
      expect(
        mergeMessages({
          draft: null,
          loading: false,
          opening: null,
          results: saved,
        })
      ).toBe(saved);
      expect(
        mergeMessages({ draft: null, loading: false, opening, results: saved })
      ).toBe(saved);
    });

    it("shows the first prompt of a started chat alone while its feed loads", () => {
      const messages = mergeMessages({
        draft: null,
        loading: true,
        opening,
        results: [],
      });

      expect(messages).toEqual([openingMessage(opening)]);
    });

    it("shows nothing while the feed of a chat that was not just started loads", () => {
      expect(
        mergeMessages({
          draft: null,
          loading: true,
          opening: null,
          results: [],
        })
      ).toEqual([]);
    });

    it("shows the pending prompt after the saved messages", () => {
      expect(
        mergeMessages({ draft, loading: false, opening: null, results: saved })
      ).toEqual([...saved, draft]);
    });

    it("hides the pending prompt once the feed carries a prompt of that turn or a later one", () => {
      for (const order of [2, 3]) {
        const results = [...saved, message(order, "user", "pending")];

        expect(
          mergeMessages({ draft, loading: false, opening: null, results })
        ).toBe(results);
      }
    });

    it("keeps the pending prompt while the feed only has earlier prompts or answers", () => {
      const results = [
        ...saved,
        message(2, "assistant"),
        message(3, "assistant"),
      ];

      expect(
        mergeMessages({ draft, loading: false, opening: null, results })
      ).toEqual([...results, draft]);
    });
  });

  describe("hasReply", () => {
    it("is true when the transcript ends with the answer to the turn", () => {
      expect(hasReply([message(0, "user"), message(0, "assistant")], 0)).toBe(
        true
      );
    });

    it("is false for an empty transcript, a prompt, another turn's answer and a chat without a turn", () => {
      expect(hasReply([], 0)).toBe(false);
      expect(hasReply([message(0, "user")], 0)).toBe(false);
      expect(hasReply([message(0, "user"), message(0, "assistant")], 1)).toBe(
        false
      );
      expect(hasReply([message(0, "user")], undefined)).toBe(false);
    });
  });

  describe("hasFailedReply", () => {
    it("is true when the answer to the turn failed in the transcript", () => {
      expect(
        hasFailedReply(
          [message(0, "user"), message(0, "assistant", "failed")],
          0
        )
      ).toBe(true);
    });

    it("is false for another turn, a settled answer, a failed prompt and a chat without a turn", () => {
      expect(hasFailedReply([message(0, "assistant", "failed")], 1)).toBe(
        false
      );
      expect(hasFailedReply([message(0, "assistant")], 0)).toBe(false);
      expect(hasFailedReply([message(0, "user", "failed")], 0)).toBe(false);
      expect(
        hasFailedReply([message(0, "assistant", "failed")], undefined)
      ).toBe(false);
    });
  });
});
