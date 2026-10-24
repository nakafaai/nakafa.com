// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import { readerHandler, readerOlderHandler } from "@/lib/chat/reader.functions";

const mocks = vi.hoisted(() => ({
  readReaderHandler: vi.fn(),
  readReaderOlderHandler: vi.fn(),
}));

vi.mock("@/lib/chat/reader.server", () => ({
  readReaderHandler: mocks.readReaderHandler,
  readReaderOlderHandler: mocks.readReaderOlderHandler,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const request = {
  chatId: Schema.decodeUnknownSync(Id("chats"))("chat-1"),
  shareToken: "abcdefghijklmnopqrstuvwxyz0123456789-_ABCDE",
};

describe("shared chat server functions", () => {
  it("hands a reader's first read of a chat to the server read", async () => {
    mocks.readReaderHandler.mockResolvedValueOnce({ status: "unavailable" });

    const answer = await readerHandler({ data: request });

    expect(mocks.readReaderHandler).toHaveBeenCalledWith({ data: request });
    expect(answer).toStrictEqual({ status: "unavailable" });
  });

  it("hands an older page of a chat to the server read with its cursors", async () => {
    const older = {
      messages: { continueCursor: "", isDone: true, json: "[]" },
      turns: null,
    };
    mocks.readReaderOlderHandler.mockResolvedValueOnce(older);
    const data = { ...request, messagesCursor: "older", threadId: "thread-1" };

    const answer = await readerOlderHandler({ data });

    expect(mocks.readReaderOlderHandler).toHaveBeenCalledWith({ data });
    expect(answer).toStrictEqual(older);
  });
});
