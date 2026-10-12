import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  boundText,
  countFileTokens,
  countTextTokens,
  NINA_BUDGET,
  NINA_CALL_LIMIT,
} from "@repo/backend/confect/nina/budget";
import { assembleContext, sentTurn } from "@repo/backend/confect/nina/history";
import { createNinaSystemPrompt } from "@repo/backend/confect/nina/prompt/system";
import { userRoles } from "@repo/backend/confect/users/role";
import { deployment, provider } from "@repo/backend/test/gateway";
import { createNinaTest, filler, ninaModel } from "@repo/backend/test/nina";
import { sealedSummary } from "@repo/backend/test/seal";
import { encodeJsonText } from "@repo/utilities/json";
import type { ModelMessage } from "ai";
import { Array as Arr, Option } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));
vi.mock("@repo/backend/confect/nina/nakafa/agent", () => ({
  runNakafaAgent: vi.fn(),
}));

const run = Ref.getFunctionReference(refs.internal.nina.response.run);
const SHORTENED_NOTE =
  /\n\n\[Shortened to about 200 of \d+ tokens\. Read the next section\.\]$/;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.restoreAllMocks();
  deployment.mockReset();
  provider.languageModel.mockReset();
  vi.useRealTimers();
});

describe("Nina file tokens", () => {
  it.each([
    ["a png image, of any size", "image/png", 1120],
    ["a jpeg image", "image/jpeg", 1120],
    ["a webp image", "image/webp", 1120],
    ["a gif image", "image/gif", 1120],
    [
      "a pdf as one page, since no stored page count exists",
      "application/pdf",
      560,
    ],
    ["a text file as one page, since no stored size exists", "text/plain", 560],
  ] as const)("counts %s", (_name, mediaType, expected) => {
    expect(countFileTokens(mediaType)).toBe(expected);
  });
});

describe("Nina token budgets", () => {
  it("returns text that already fits unchanged", () => {
    const text = "A short explanation of limits.";
    expect(boundText(text, 100, "Read more.")).toBe(text);
  });

  it("cuts long text on a paragraph boundary and explains the omission", () => {
    const paragraph = "Limits describe values a function approaches. ".repeat(
      12
    );
    const text = Arr.join([paragraph, paragraph, paragraph, paragraph], "\n\n");
    const bounded = boundText(text, 200, "Read the next section.");
    expect(countTextTokens(bounded)).toBeLessThanOrEqual(200);
    expect(bounded).toMatch(SHORTENED_NOTE);
    expect(text.startsWith(bounded.slice(0, bounded.indexOf("\n\n[")))).toBe(
      true
    );
  });

  it("keeps the token cut when no boundary is close", () => {
    const text = "word ".repeat(600);
    const bounded = boundText(text, 150, "Narrow the request.");
    expect(countTextTokens(bounded)).toBeLessThanOrEqual(150);
    expect(bounded).toContain("Narrow the request.");
  });
});

describe("Nina call limit", () => {
  it("does not shorten the words of an oversized newest earlier turn, which the limit leaves out", () => {
    // A learner who pasted a long text and got a short reply: that turn alone costs more than the history.
    const earlier: ModelMessage[] = [
      { role: "user", content: "word ".repeat(NINA_BUDGET.history + 3000) },
      { role: "assistant", content: "A short reply." },
    ];
    expect(sentTurn(earlier).tokens).toBeGreaterThan(NINA_BUDGET.history);
    expect(
      assembleContext({
        current: [{ role: "user", content: "Follow up" }],
        history: [earlier],
      })
    ).toEqual([...earlier, { role: "user", content: "Follow up" }]);
  });

  it("states the instructions, tool definitions and runtime facts of a call as a part that the real ones fit", async () => {
    const languageModel = ninaModel();
    provider.languageModel.mockReturnValue(languageModel);
    const f = await createNinaTest();
    await f.t.action(run, { turnId: f.turnId });
    const [call] = languageModel.doStreamCalls;
    // A question focus adds instructions, and the roles differ in length.
    const instructions = Math.max(
      ...Arr.map([...userRoles, undefined], (userRole) =>
        countTextTokens(
          createNinaSystemPrompt({
            focus: "A focused question.",
            ...(userRole === undefined ? {} : { userRole }),
          })
        )
      )
    );
    const tools = countTextTokens(encodeJsonText(call?.tools));
    // The newest message holds the runtime facts of the turn and a short question.
    const runtime = countTextTokens(
      encodeJsonText(Option.getOrThrow(Arr.last(call?.prompt ?? [])))
    );
    expect(Arr.map(call?.tools ?? [], ({ name }) => name)).toEqual([
      "nakafa",
      "deepResearch",
      "math",
    ]);
    const measured = instructions + tools + runtime;
    expect(measured).toBeLessThanOrEqual(NINA_BUDGET.instructions);
    // The stated part is the measure rounded up to the next 1,000 tokens.
    expect(NINA_BUDGET.instructions - measured).toBeLessThan(1000);
  }, 30_000);

  it("holds a call whose history and summary are full inside the limit", async () => {
    const languageModel = ninaModel();
    provider.languageModel.mockReturnValue(languageModel);
    // Eight turns of about 4,500 tokens. The summary covers the first, and the
    // other seven cost 31,500, just inside the history budget of 32,000.
    const f = await createNinaTest({
      history: Arr.makeBy(8, () => ({ tokens: 4500 })),
    });
    await f.t.mutation(async (ctx) =>
      ctx.db.insert("ninaSummaries", {
        chatId: f.chatId,
        text: await sealedSummary(
          ctx,
          f.identity.userId,
          filler(NINA_BUDGET.summary - 100)
        ),
        throughOrder: 0,
        updatedAt: Date.UTC(2026, 9, 12),
        usage: { calls: 1, input: 900, output: 120 },
      })
    );
    await f.t.action(run, { turnId: f.turnId });
    const [call] = languageModel.doStreamCalls;
    const prompt = encodeJsonText(call?.prompt);
    const carried =
      countTextTokens(prompt) + countTextTokens(encodeJsonText(call?.tools));
    expect(prompt).not.toContain('"Earlier question 0"');
    expect(prompt).toContain('"Earlier question 1"');
    expect(prompt).toContain('"Earlier question 7"');
    expect(carried).toBeGreaterThan(NINA_BUDGET.history);
    expect(carried).toBeLessThanOrEqual(NINA_CALL_LIMIT);
  }, 30_000);
});
