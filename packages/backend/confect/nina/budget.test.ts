import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { languageModel } from "@repo/backend/confect/gateway/model";
import {
  boundText,
  countFileTokens,
  countTextTokens,
  NINA_BUDGET,
  NINA_CALL_LIMIT,
} from "@repo/backend/confect/nina/budget";
import { LearningCapabilityNameSchema } from "@repo/backend/confect/nina/capability/spec";
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
const LONG_RUN_NOTE = /\[Shortened to about 200 of \d+ tokens\. Read more\.\]$/;
const SHORTENED_NOTE =
  /\n\n\[Shortened to about 200 of \d+ tokens\. Read the next section\.\]$/;
/** The unit that the large output caps of `purposes` are whole multiples of. */
const CAP_UNIT = 1024;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.restoreAllMocks();
  deployment.mockReset();
  provider.languageModel.mockReset();
  vi.useRealTimers();
});

describe("Nina file tokens", () => {
  it.each([
    ["a png image, of any size", "image/png", "image"],
    ["a jpeg image", "image/jpeg", "image"],
    ["a webp image", "image/webp", "image"],
    ["a gif image", "image/gif", "image"],
    [
      "a pdf as one page, since no stored page count exists",
      "application/pdf",
      "documentPage",
    ],
    [
      "a text file as one page, since no stored size exists",
      "text/plain",
      "documentPage",
    ],
  ] as const)(
    "counts %s at the profile's cost of its kind",
    (_name, mediaType, kind) => {
      expect(countFileTokens(mediaType)).toBe(languageModel.files[kind]);
    }
  );
});

/**
 * The rules of the estimator at fixed costs. The table below pins the rules, so
 * a model change that moves the profile's costs leaves these expectations alone.
 */
const RULE_COSTS = {
  latinLettersPerToken: 2.25,
  otherLetter: 1,
  han: 1.25,
  digit: 1,
  other: 1,
  newline: 0,
  space: 0,
  spaceRun: 0.5,
  underscore: 0,
  message: 8,
  undercount: 939,
};

describe("Nina token estimate", () => {
  // Each expectation is the sum of the rules for its text, worked out by hand: a
  // run of Latin letters costs one token per 2.25 letters, rounded up over the
  // run; a Han character 1.25; a run of two or more spaces 0.5, one space 0; a
  // newline and an underscore 0; any other character, a digit, or a letter of
  // another script 1.
  it.each([
    ["a word of four letters", "word", 2],
    ["nine letters", "abcdefghi", 4],
    ["ten letters", "abcdefghij", 5],
    ["Latin letters with a diacritic", "é", 1],
    ["two Han characters", "中文", 3],
    ["one space between words", "a b", 2],
    ["a run of two spaces", "a  b", 3],
    ["a newline", "a\nb", 2],
    ["an underscore", "a_b", 2],
    ["digits and symbols", "1+1=2", 5],
    ["letters of another script", "αβγ", 3],
    ["an emoji", "🙂", 1],
  ])("prices %s by the rules", (_name, text, expected) => {
    expect(countTextTokens(text, RULE_COSTS)).toBe(expected);
  });

  it("charges the provider's overhead on every message, not only on its content", () => {
    expect(sentTurn([{ role: "user", content: "word" }]).tokens).toBe(
      languageModel.tokens.message + 2
    );
  });
});

describe("Nina token budgets", () => {
  it("returns text that already fits unchanged", () => {
    const text = "A short explanation of limits.";
    expect(boundText(text, 100, "Read more.")).toBe(text);
  });

  it("cuts long text on a paragraph boundary and explains the omission", () => {
    // The first paragraph ends inside the kept text, past its last 40 percent,
    // so the cut moves back to the paragraph break and not to the token limit.
    const sentence = "Limits describe values a function approaches. ";
    const text = Arr.join([sentence.repeat(6), sentence.repeat(12)], "\n\n");
    const bounded = boundText(text, 200, "Read the next section.");
    expect(countTextTokens(bounded)).toBeLessThanOrEqual(200);
    expect(bounded).toMatch(SHORTENED_NOTE);
    expect(
      bounded.startsWith(`${sentence.repeat(6).trimEnd()}\n\n[Shortened`)
    ).toBe(true);
  });

  it("keeps the token cut when no boundary is close", () => {
    const text = "word ".repeat(600);
    const bounded = boundText(text, 150, "Narrow the request.");
    expect(countTextTokens(bounded)).toBeLessThanOrEqual(150);
    expect(bounded).toContain("Narrow the request.");
  });

  it("cuts inside one unbroken run of letters that alone outgrows the limit", () => {
    // The run is one piece of the estimator, so it must be cut inside, not
    // dropped whole, which would leave the note and none of the learner's words.
    const bounded = boundText("a".repeat(30_000), 200, "Read more.");
    expect(bounded.startsWith("aaaa")).toBe(true);
    expect(bounded).toMatch(LONG_RUN_NOTE);
    expect(countTextTokens(bounded)).toBeLessThanOrEqual(200);
    expect(countTextTokens(bounded)).toBeGreaterThan(150);
  });
});

describe("Nina output caps", () => {
  it("keeps the output cap of a specialist just above the evidence that Nina reads of its answer", () => {
    const cap = languageModel.output.specialist;
    // Nina reads at most the evidence budget of a specialist's answer. A cap at
    // or below it would end an answer before Nina had read all it may, so the
    // cap stands above it. It stays within one unit of it, so that it follows
    // the budget and does not drift to a number of its own. The reasoning of the
    // call counts against the cap too, so the room above the budget is all it
    // has when an answer fills the budget.
    expect(cap).toBeGreaterThan(NINA_BUDGET.evidence);
    expect(cap - NINA_BUDGET.evidence).toBeLessThan(CAP_UNIT);
  });
});

describe("Nina call limit", () => {
  it("does not shorten the words of an oversized newest earlier turn, which the limit leaves out", () => {
    // A learner who pasted a long text and got a short reply: that turn alone costs more than the history.
    const earlier: ModelMessage[] = [
      { role: "user", content: "word ".repeat(NINA_BUDGET.history) },
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

  it("gives a call with a large current turn less history, so the call stays within its limit", () => {
    // Each earlier turn costs 14,024 tokens, so the two together (28,048) fit the
    // history budget of 32,610. A current message of 32,608 tokens leaves 28,002
    // of the call limit for the history (90,610 less 30,000 reserved and the
    // message), less than the two turns, so the older turn is left out.
    const older: ModelMessage[] = [
      { role: "user", content: "word ".repeat(7000) },
      { role: "assistant", content: "An older answer." },
    ];
    const newer: ModelMessage[] = [
      { role: "user", content: "word ".repeat(7000) },
      { role: "assistant", content: "A newer answer." },
    ];
    const current: ModelMessage[] = [
      { role: "user", content: "word ".repeat(16_300) },
    ];
    expect(assembleContext({ current, history: [older, newer] })).toEqual([
      ...newer,
      ...current,
    ]);
  });

  it("states the instructions, tool definitions and runtime facts of a call as a part that the real ones fit", async () => {
    const languageModel = ninaModel();
    provider.languageModel.mockReturnValue(languageModel);
    const f = await createNinaTest();
    // A learner who connected Calendar is offered every tool, the largest part.
    await f.t.mutation((ctx) =>
      ctx.db.insert("connectorConnections", {
        connector: "calendar",
        googleAccountKey: null,
        lastSyncedAt: null,
        nextSyncAt: null,
        owner: { kind: "personal", userId: f.identity.userId },
        scopes: ["openid"],
        status: "active",
      })
    );
    await f.t.action(run, { turnId: f.turnId });
    const [call] = languageModel.doStreamCalls;
    // A question focus adds instructions, and the roles differ in length.
    const instructions = Math.max(
      ...Arr.map([...userRoles, undefined], (userRole) =>
        countTextTokens(
          createNinaSystemPrompt({
            capabilities: LearningCapabilityNameSchema.literals,
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
      "memory",
      "calendar",
    ]);
    const measured = instructions + tools + runtime;
    expect(measured).toBeLessThanOrEqual(NINA_BUDGET.instructions);
    // The stated part is the measure rounded up to the next 500 tokens.
    expect(NINA_BUDGET.instructions - measured).toBeLessThan(500);
  }, 30_000);

  it("holds a call whose history and summary are full inside the limit", async () => {
    const languageModel = ninaModel();
    provider.languageModel.mockReturnValue(languageModel);
    // Eight turns of about 4,400 tokens. The summary covers the first, and the
    // other seven cost 30,800, inside the history budget of 31,610.
    const f = await createNinaTest({
      history: Arr.makeBy(8, () => ({ tokens: 4400 })),
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

  /** A turn with one photo and its answer. Odd turns name the media type and even turns do not: both count the same. */
  function photoTurn(number: number): ModelMessage[] {
    return [
      {
        role: "user",
        content: [
          { type: "text", text: `Photo ${number}` },
          number % 2 === 0
            ? { type: "image", image: "photo" }
            : { type: "image", image: "photo", mediaType: "image/png" },
        ],
      },
      { role: "assistant", content: `Answer ${number}` },
    ];
  }

  it("counts an earlier image at what the model bills, so a few images fill the history budget", () => {
    const result = assembleContext({
      current: [{ role: "user", content: "Latest" }],
      history: Arr.map(Arr.range(1, 30), photoTurn),
    });
    // Each turn costs at least one image, so the photos kept fit the history
    // budget, and the oldest photo does not fit.
    const photos = (encodeJsonText(result).match(/Photo \d+/g) ?? []).length;
    expect(photos * languageModel.files.image).toBeLessThanOrEqual(
      NINA_BUDGET.history
    );
    expect(encodeJsonText(result)).not.toContain('"Photo 1"');
    expect(encodeJsonText(result)).toContain('"Photo 30"');
  });

  it("keeps the image blocks of one request within the provider's many-image limit", () => {
    // Above twenty image blocks in one request, the provider rejects any image
    // whose side is over 2,000 pixels, and it counts the images of earlier turns
    // too. So a long chat with photos keeps its request well under twenty.
    const result = assembleContext({
      current: [
        {
          role: "user",
          content: [
            { type: "text", text: "Latest" },
            { type: "image", image: "photo", mediaType: "image/png" },
          ],
        },
      ],
      history: Arr.map(Arr.range(1, 25), photoTurn),
    });
    // Every image block of the request, the current message's included.
    const blocks = encodeJsonText(result).split('"type":"image"').length - 1;
    expect(blocks).toBeLessThanOrEqual(20);
  });
});
