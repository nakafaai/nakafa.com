import { vMessageStatus, vStreamMessage } from "@convex-dev/agent/validators";
import { describe, expect, it } from "@effect/vitest";
import {
  AgentMessageStatus,
  StreamFormat,
  StreamStatus,
} from "@repo/backend/confect/nina/contract/message";
import { Array as Arr } from "effect";

describe("Nina message vocabulary", () => {
  it("matches the values that the Agent component validates, in their order", () => {
    expect(AgentMessageStatus.literals).toEqual([
      "streaming",
      ...Arr.map(vMessageStatus.members, (status) => status.value),
    ]);
    expect(StreamStatus.literals).toEqual(
      Arr.map(vStreamMessage.fields.status.members, (status) => status.value)
    );
    expect(StreamFormat.literals).toEqual(
      Arr.map(vStreamMessage.fields.format.members, (format) => format.value)
    );
  });
});
