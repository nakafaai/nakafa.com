import { Agent } from "@convex-dev/agent";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { researchMaxSources } from "@repo/backend/client/nina/research";
import { runNakafaAgent } from "@repo/backend/confect/nina/nakafa/agent";
import { quran } from "@repo/backend/confect/nina/nakafa/tools/quran";
import { read } from "@repo/backend/confect/nina/nakafa/tools/read";
import { search } from "@repo/backend/confect/nina/nakafa/tools/search";
import { taxonomy } from "@repo/backend/confect/nina/nakafa/tools/taxonomy";
import { provider } from "@repo/backend/test/gateway";
import { withTimeLeft } from "@repo/backend/test/nina/deadline";
import {
  providerStep,
  runSpecialist,
  specialistRequest,
} from "@repo/backend/test/nina/specialist";
import { readNakafaContentRefFixture } from "@repo/contents/test/fixture";
import { encodeJsonText } from "@repo/utilities/json";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, Effect, Option } from "effect";

vi.mock("@repo/backend/confect/nina/nakafa/tools/read", () => ({
  read: vi.fn(),
}));
vi.mock("@repo/backend/confect/nina/nakafa/tools/search", () => ({
  search: vi.fn(),
}));
vi.mock("@repo/backend/confect/nina/nakafa/tools/quran", () => ({
  quran: vi.fn(),
}));
vi.mock("@repo/backend/confect/nina/nakafa/tools/taxonomy", () => ({
  taxonomy: vi.fn(),
}));
afterEach(() => {
  vi.restoreAllMocks();
  provider.languageModel.mockReset();
});

const content = readNakafaContentRefFixture(
  "en",
  "articles/science/limits",
  "articles"
);
const final = providerStep([{ type: "text", text: "A bounded explanation." }]);
/** The evidence it read, then the note that tells Nina the run was cut short. */
const cutEvidence = /^Verified lesson\.\n\n.*cut short/su;
/** A request from a learner who sent no link to Nakafa's own site. */
const noLinks = { ...specialistRequest, addresses: [] };
function call(toolName: string, input: object, toolCallId = toolName) {
  return providerStep(
    [
      {
        type: "tool-call",
        toolName,
        toolCallId,
        input: encodeJsonText(input),
      },
    ],
    "tool-calls"
  );
}

describe("Nakafa Agent execution", () => {
  it.each([
    ["read", { content_ref: content.content_id }],
    ["quran", { surah: 1 }],
    ["taxonomy", {}],
  ] as const)(
    "runs %s with native tool validation and accounted usage",
    async (toolName, input) => {
      const usageHandler = vi.fn();
      vi.mocked(read).mockReturnValue(Effect.succeed("Verified lesson."));
      vi.mocked(quran).mockReturnValue(Effect.succeed("Verified verse."));
      vi.mocked(taxonomy).mockReturnValue(
        Effect.succeed("Verified inventory.")
      );
      const model = new MockLanguageModelV4({
        doGenerate: [call(toolName, input), final],
      });
      provider.languageModel.mockReturnValue(model);
      const result = await runSpecialist((userId) =>
        runNakafaAgent({
          ...noLinks,
          userId,
          publish: () => Effect.void,
          usageHandler,
        })
      );
      expect(result.text).toContain("Verified");
      expect(usageHandler).toHaveBeenCalledTimes(2);
      expect(usageHandler).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          agentName: "nakafa",
          userId: expect.any(String),
        })
      );
      expect(model.doGenerateCalls).toHaveLength(2);
    }
  );

  it.each([false, true])(
    "reads search evidence when content exists: %s",
    async (found) => {
      vi.mocked(search).mockReturnValue(
        Effect.succeed({
          text: found
            ? "A matching lesson."
            : "Search did not establish a match.",
          result: found
            ? {
                count: 1,
                has_more: false,
                items: [
                  {
                    ...content,
                    title: "Limits",
                    description: "Limits",
                    excerpt: "Limits",
                  },
                ],
                limit: 10,
                offset: 0,
              }
            : null,
        })
      );
      vi.mocked(read).mockReturnValue(Effect.succeed("Full signed lesson."));
      const model = new MockLanguageModelV4({
        doGenerate: [
          call("search", { queries: ["limits"], limit: 10, offset: 0 }),
          ...(found ? [call("read", { content_ref: content.content_id })] : []),
          final,
        ],
      });
      provider.languageModel.mockReturnValue(model);
      const result = await runSpecialist((userId) =>
        runNakafaAgent({
          ...noLinks,
          userId,
          publish: () => Effect.void,
          usageHandler: vi.fn(),
        })
      );
      expect(result.text).toContain(
        found ? "Full signed lesson." : "Search did not establish a match."
      );
      if (found) {
        expect(model.doGenerateCalls[1]?.toolChoice).toEqual({
          type: "tool",
          toolName: "read",
        });
      } else {
        expect(read).not.toHaveBeenCalled();
      }
    }
  );

  it("reads the links the learner sent in its first step, before any search", async () => {
    const lesson = "https://nakafa.com/en/articles/science/limits";
    vi.mocked(read).mockReturnValue(
      Effect.succeed("The lesson the learner sent.")
    );
    const model = new MockLanguageModelV4({
      doGenerate: [call("read", { content_ref: lesson }), final],
    });
    provider.languageModel.mockReturnValue(model);
    const result = await runSpecialist((userId) =>
      runNakafaAgent({
        ...noLinks,
        userId,
        addresses: [lesson],
        publish: () => Effect.void,
        usageHandler: vi.fn(),
      })
    );
    expect(model.doGenerateCalls[0]?.toolChoice).toEqual({
      type: "tool",
      toolName: "read",
    });
    expect(
      Arr.map(model.doGenerateCalls[0]?.tools ?? [], (tool) => tool.name)
    ).toEqual(["read"]);
    expect(encodeJsonText(model.doGenerateCalls[0]?.prompt)).toContain(
      `- ${lesson}`
    );
    expect(read).toHaveBeenCalledWith(
      expect.objectContaining({ input: { content_ref: lesson } })
    );
    expect(result.text).toContain("The lesson the learner sent.");
    // Once the address was asked for, the model chooses what comes next.
    expect(model.doGenerateCalls[1]?.toolChoice).not.toEqual({
      type: "tool",
      toolName: "read",
    });
  });

  it("keeps forcing a read, step after step, until the model has asked for every link the learner sent", async () => {
    const [lesson, verses] = [
      "https://nakafa.com/en/articles/science/limits",
      "https://nakafa.com/id/quran/1",
    ];
    vi.mocked(read).mockImplementation(({ input }) =>
      Effect.succeed(`Read ${input.content_ref}.`)
    );
    // The model asks for one address in its first step and the other in its second.
    const model = new MockLanguageModelV4({
      doGenerate: [
        call("read", { content_ref: lesson }, "first"),
        call("read", { content_ref: verses }, "second"),
        final,
      ],
    });
    provider.languageModel.mockReturnValue(model);
    const result = await runSpecialist((userId) =>
      runNakafaAgent({
        ...noLinks,
        userId,
        addresses: [lesson, verses],
        publish: () => Effect.void,
        usageHandler: vi.fn(),
      })
    );
    const forcedRead = { type: "tool", toolName: "read" };
    expect(model.doGenerateCalls[0]?.toolChoice).toEqual(forcedRead);
    expect(model.doGenerateCalls[1]?.toolChoice).toEqual(forcedRead);
    // The second step asks only for the address the first one left.
    const secondAsk = encodeJsonText(
      Option.getOrThrow(Arr.last(model.doGenerateCalls[1]?.prompt ?? []))
    );
    expect(secondAsk).toContain(`- ${verses}`);
    expect(secondAsk).not.toContain(lesson);
    // With every address asked for, the model is free again.
    expect(model.doGenerateCalls[2]?.toolChoice).not.toEqual(forcedRead);
    expect(model.doGenerateCalls[2]?.tools).toHaveLength(4);
    expect(read).toHaveBeenCalledTimes(2);
    expect(result.text).toBe(`Read ${lesson}.\n\nRead ${verses}.`);
  });

  it("reads none of the links, and asks for fewer, when the learner sent more than it may read", async () => {
    const model = new MockLanguageModelV4({ doGenerate: final });
    provider.languageModel.mockReturnValue(model);
    const result = await runSpecialist((userId) =>
      runNakafaAgent({
        ...noLinks,
        userId,
        addresses: Arr.makeBy(
          researchMaxSources + 1,
          (index) => `https://nakafa.com/en/articles/science/page-${index}`
        ),
        publish: () => Effect.void,
        usageHandler: vi.fn(),
      })
    );
    expect(result).toEqual({
      outcome: "limit",
      text: expect.stringContaining(`at most ${researchMaxSources} links`),
    });
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(read).not.toHaveBeenCalled();
  });

  it("reads as many links as it may read at once", async () => {
    vi.mocked(read).mockReturnValue(Effect.succeed("A page."));
    const addresses = Arr.makeBy(
      researchMaxSources,
      (index) => `https://nakafa.com/en/articles/science/page-${index}`
    );
    const model = new MockLanguageModelV4({
      doGenerate: [
        providerStep(
          Arr.map(addresses, (address, index) => ({
            type: "tool-call" as const,
            toolName: "read",
            toolCallId: `read-${index}`,
            input: encodeJsonText({ content_ref: address }),
          })),
          "tool-calls"
        ),
        final,
      ],
    });
    provider.languageModel.mockReturnValue(model);
    await runSpecialist((userId) =>
      runNakafaAgent({
        ...noLinks,
        userId,
        addresses,
        publish: () => Effect.void,
        usageHandler: vi.fn(),
      })
    );
    expect(read).toHaveBeenCalledTimes(researchMaxSources);
    // One step asked for them all, so the next one is free.
    expect(model.doGenerateCalls).toHaveLength(2);
  });

  it("leaves its first step to the model when the learner sent no link", async () => {
    const model = new MockLanguageModelV4({ doGenerate: final });
    provider.languageModel.mockReturnValue(model);
    await runSpecialist((userId) =>
      runNakafaAgent({
        ...noLinks,
        userId,
        publish: () => Effect.void,
        usageHandler: vi.fn(),
      })
    );
    expect(model.doGenerateCalls[0]?.toolChoice).not.toEqual({
      type: "tool",
      toolName: "read",
    });
    expect(model.doGenerateCalls[0]?.tools).toHaveLength(4);
  });

  it("cuts its model call to the time the capability has left", async () => {
    provider.languageModel.mockReturnValue(
      new MockLanguageModelV4({ doGenerate: final })
    );
    const generate = vi.spyOn(Agent.prototype, "generateText");
    await runSpecialist((userId) =>
      runNakafaAgent({
        ...noLinks,
        userId,
        publish: () => Effect.void,
        usageHandler: vi.fn(),
      }).pipe(withTimeLeft("7 seconds"))
    );
    expect(Arr.map(generate.mock.calls, ([, , call]) => call.timeout)).toEqual([
      { stepMs: 7000, totalMs: 7000 },
    ]);
  });

  it("returns the model answer when no tool ran", async () => {
    provider.languageModel.mockReturnValue(
      new MockLanguageModelV4({ doGenerate: final })
    );
    expect(
      await runSpecialist((userId) =>
        runNakafaAgent({
          ...noLinks,
          userId,
          publish: () => Effect.void,
          usageHandler: vi.fn(),
        })
      )
    ).toEqual({ text: "A bounded explanation." });
  });

  it("hands Nina what it read as partial, and says it was cut short, when its last step ended at the output cap", async () => {
    vi.mocked(read).mockReturnValue(Effect.succeed("Verified lesson."));
    provider.languageModel.mockReturnValue(
      new MockLanguageModelV4({
        doGenerate: [
          call("read", { content_ref: content.content_id }),
          providerStep([{ type: "text", text: "A cut expla" }], "length"),
        ],
      })
    );
    expect(
      await runSpecialist((userId) =>
        runNakafaAgent({
          ...noLinks,
          userId,
          publish: () => Effect.void,
          usageHandler: vi.fn(),
        })
      )
    ).toEqual({
      outcome: "partial",
      text: expect.stringMatching(cutEvidence),
    });
  });
  it("preserves a typed failure when generation cannot run", async () => {
    provider.languageModel.mockReturnValue(
      new MockLanguageModelV4({
        doGenerate: () => Promise.reject(new Error("Provider failure")),
      })
    );
    const error = await runSpecialist((userId) =>
      runNakafaAgent({
        ...noLinks,
        userId,
        publish: () => Effect.void,
        usageHandler: vi.fn(),
      }).pipe(
        Effect.flip,
        Effect.map(({ _tag, message }) => ({ _tag, message }))
      )
    );
    expect(error._tag).toBe("NakafaGenerationError");
  });
});
