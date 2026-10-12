import { vMessageStatus, vStreamMessage } from "@convex-dev/agent/validators";
import { describe, expect, it } from "@effect/vitest";
import { MessagePage } from "@repo/backend/confect/nina/contract/message";
import { Array as Arr, Result, Schema } from "effect";

/** A page of one message with the given status. */
function pageOfMessage(status: string) {
  return {
    page: [
      {
        id: "message",
        key: "key",
        order: 0,
        stepOrder: 0,
        status,
        role: "assistant",
        text: "",
        parts: [],
        _creationTime: 0,
      },
    ],
    isDone: true,
    continueCursor: "",
    streams: { kind: "list", messages: [] },
  };
}

/** A page of no message that lists one stream with the given status and format. */
function pageOfStream(status: string, format: string) {
  return {
    page: [],
    isDone: true,
    continueCursor: "",
    streams: {
      kind: "list",
      messages: [
        { streamId: "stream", status, format, order: 0, stepOrder: 0 },
      ],
    },
  };
}

/** Whether the contract reads a page as the Agent component's answer. */
function reads(page: unknown) {
  return Result.isSuccess(Schema.decodeUnknownResult(MessagePage)(page));
}

describe("Nina message vocabulary", () => {
  it.each([
    "streaming",
    ...Arr.map(vMessageStatus.members, (status) => status.value),
  ])("reads a message that is %s", (status) => {
    expect(reads(pageOfMessage(status))).toBe(true);
  });

  it.each(
    Arr.map(vStreamMessage.fields.status.members, (status) => status.value)
  )("reads a stream that is %s", (status) => {
    expect(reads(pageOfStream(status, "UIMessageChunk"))).toBe(true);
  });

  it.each(
    Arr.map(vStreamMessage.fields.format.members, (format) => format.value)
  )("reads a stream in the %s format", (format) => {
    expect(reads(pageOfStream("finished", format))).toBe(true);
  });

  it("refuses a status or a format that the Agent component does not store", () => {
    expect(reads(pageOfMessage("paused"))).toBe(false);
    expect(reads(pageOfStream("paused", "UIMessageChunk"))).toBe(false);
    expect(reads(pageOfStream("finished", "Markdown"))).toBe(false);
  });
});
