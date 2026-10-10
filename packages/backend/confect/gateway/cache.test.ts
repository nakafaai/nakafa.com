import { describe, expect, it } from "@effect/vitest";
import { markCachedPrefix } from "@repo/backend/confect/gateway/cache";

const marker = { openaiCompatible: { cache_control: { type: "ephemeral" } } };
const system = { role: "system" as const, content: "Static instructions." };
const earlier = {
  role: "user" as const,
  content: [{ type: "text" as const, text: "An earlier question." }],
};
const answer = {
  role: "assistant" as const,
  content: [{ type: "text" as const, text: "An earlier answer." }],
};
const question = {
  role: "user" as const,
  content: [{ type: "text" as const, text: "The newest question." }],
};
const call = {
  role: "assistant" as const,
  content: [
    {
      type: "tool-call" as const,
      toolCallId: "call-1",
      toolName: "nakafa",
      input: {},
    },
  ],
};
const evidence = {
  role: "tool" as const,
  content: [
    {
      type: "tool-result" as const,
      toolCallId: "call-1",
      toolName: "nakafa",
      output: { type: "text" as const, value: "Evidence." },
    },
  ],
};

describe("the cached prompt prefix", () => {
  it("marks the system message of a first turn, never the newest question", () => {
    expect(markCachedPrefix([system, question])).toEqual([
      { ...system, providerOptions: marker },
      question,
    ]);
  });

  it("keeps the marker on the same message in every later step of a turn", () => {
    const first = markCachedPrefix([system, earlier, answer, question]);
    const later = markCachedPrefix([
      system,
      earlier,
      answer,
      question,
      call,
      evidence,
    ]);
    const prefix = [system, earlier, { ...answer, providerOptions: marker }];
    expect(first).toEqual([...prefix, question]);
    expect(later).toEqual([...prefix, question, call, evidence]);
  });

  it("marks the last part of a user or tool message, where the gateway reads it", () => {
    const attached = {
      role: "user" as const,
      content: [
        { type: "text" as const, text: "See the file." },
        { type: "text" as const, text: "And this note." },
      ],
    };
    expect(markCachedPrefix([system, attached, question])).toEqual([
      system,
      {
        ...attached,
        content: [
          attached.content[0],
          { ...attached.content[1], providerOptions: marker },
        ],
      },
      question,
    ]);
    expect(
      markCachedPrefix([system, earlier, call, evidence, question])
    ).toEqual([
      system,
      earlier,
      call,
      {
        ...evidence,
        content: [{ ...evidence.content[0], providerOptions: marker }],
      },
      question,
    ]);
  });

  it("keeps the options a message already carries", () => {
    const signed = {
      ...answer,
      providerOptions: {
        google: { thoughtSignature: "signature" },
        openaiCompatible: { reasoning: "kept" },
      },
    };
    expect(markCachedPrefix([system, earlier, signed, question])[2]).toEqual({
      ...answer,
      providerOptions: {
        google: { thoughtSignature: "signature" },
        openaiCompatible: {
          cache_control: { type: "ephemeral" },
          reasoning: "kept",
        },
      },
    });
  });

  it("leaves a prompt without a user message, or with nothing before it, unmarked", () => {
    expect(markCachedPrefix([system])).toEqual([system]);
    expect(markCachedPrefix([question])).toEqual([question]);
  });
});
