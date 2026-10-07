import { afterEach, describe, expect, it } from "@effect/vitest";
import { runNakafaAgent } from "@repo/backend/confect/nina/nakafa/agent";
import { quran } from "@repo/backend/confect/nina/nakafa/tools/quran";
import { read } from "@repo/backend/confect/nina/nakafa/tools/read";
import { search } from "@repo/backend/confect/nina/nakafa/tools/search";
import { taxonomy } from "@repo/backend/confect/nina/nakafa/tools/taxonomy";
import { provider } from "@repo/backend/test/gateway";
import {
  providerStep,
  runSpecialist,
  specialistRequest,
} from "@repo/backend/test/nina/specialist";
import { readNakafaContentRefFixture } from "@repo/contents/agent/fixture";
import { MockLanguageModelV4 } from "ai/test";
import { Effect } from "effect";

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
function call(toolName: string, input: object) {
  return providerStep(
    [
      {
        type: "tool-call",
        toolName,
        toolCallId: toolName,
        input: JSON.stringify(input),
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
          ...specialistRequest,
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
          ...specialistRequest,
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

  it("returns the model answer when no tool ran", async () => {
    provider.languageModel.mockReturnValue(
      new MockLanguageModelV4({ doGenerate: final })
    );
    expect(
      await runSpecialist((userId) =>
        runNakafaAgent({
          ...specialistRequest,
          userId,
          publish: () => Effect.void,
          usageHandler: vi.fn(),
        })
      )
    ).toEqual({ text: "A bounded explanation." });
  });
  it("preserves a typed failure when generation cannot run", async () => {
    provider.languageModel.mockReturnValue(
      new MockLanguageModelV4({
        doGenerate: () => Promise.reject(new Error("Provider failure")),
      })
    );
    const error = await runSpecialist((userId) =>
      runNakafaAgent({
        ...specialistRequest,
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
