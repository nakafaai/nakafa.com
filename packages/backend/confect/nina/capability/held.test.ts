import { describe, expect, it } from "@effect/vitest";
import {
  type Held,
  restoreHeld,
} from "@repo/backend/confect/nina/capability/held";
import type { ModelMessage } from "ai";
import { MutableHashMap } from "effect";

const result = (toolCallId: string, toolName: string): ModelMessage => ({
  content: [
    {
      output: { type: "json", value: { artifacts: [], text: "A note." } },
      toolCallId,
      toolName,
      type: "tool-result",
    },
  ],
  role: "tool",
});

describe("the words a capability held back, for the next step of its turn", () => {
  it("go back into the result of the call that held them, and into no other", () => {
    const held: Held = MutableHashMap.make([
      { toolCallId: "recall-1", toolName: "memory" },
      "# Memories Found",
    ]);
    const messages: ModelMessage[] = [
      { content: "Kapan ujianku?", role: "user" },
      result("recall-1", "memory"),
      result("recall-2", "memory"),
      result("recall-1", "nakafa"),
    ];
    expect(restoreHeld(messages, held)).toEqual([
      messages[0],
      {
        content: [
          expect.objectContaining({
            output: { type: "text", value: "# Memories Found" },
            toolCallId: "recall-1",
          }),
        ],
        role: "tool",
      },
      messages[2],
      messages[3],
    ]);
  });

  it("leave a part of a tool message that is not a result as it is", () => {
    const held: Held = MutableHashMap.make([
      { toolCallId: "recall-1", toolName: "memory" },
      "# Memories Found",
    ]);
    const approval: ModelMessage = {
      content: [
        {
          approvalId: "approval-1",
          approved: true,
          type: "tool-approval-response",
        },
      ],
      role: "tool",
    };
    expect(restoreHeld([approval], held)).toEqual([approval]);
  });

  it("are not in the messages of a turn that held none", () => {
    const messages: ModelMessage[] = [result("recall-1", "memory")];
    expect(restoreHeld(messages, MutableHashMap.empty())).toEqual(messages);
  });
});
