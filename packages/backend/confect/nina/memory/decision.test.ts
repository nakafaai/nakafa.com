import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  isLasting,
  judgeCandidates,
} from "@repo/backend/confect/nina/memory/decision";
import type { NinaMemoryCandidate } from "@repo/backend/confect/nina/memory.spec";
import { decides, GatewayTest, provider } from "@repo/backend/test/gateway";
import { runSpecialist } from "@repo/backend/test/nina/specialist";
import { APICallError } from "ai";
import { Experimental_DecisionMockModelV4 as DecisionMockModel } from "ai/test";
import { Array as Arr, Effect, Record as Rec } from "effect";

/** A probability well above every threshold, and one well below. */
const SURE = 0.99;
const UNLIKELY = 0.01;

/** A decision the gateway cannot answer, with detail that must never travel on. */
const unavailable = new DecisionMockModel({
  doDecide: () =>
    Promise.reject(
      new APICallError({
        isRetryable: false,
        message: "Private provider detail",
        requestBodyValues: { state: "Kelas 12 IPA." },
        statusCode: 503,
        url: "https://ai-gateway.convex.dev/alpha/decisions",
      })
    ),
});

/** Candidates in three languages, each with the quote that supports it. */
const candidates: (typeof NinaMemoryCandidate.Type)[] = [
  { kind: "level", quote: "aku kelas 12", text: "Kelas 12." },
  {
    kind: "goal",
    quote: "nomor teleponku 0812 3456 7890",
    text: "Nomor telepon 0812 3456 7890.",
  },
  {
    kind: "style",
    quote: "ich lerne mit Beispielen",
    text: "Lernt mit Beispielen.",
  },
];

afterEach(() => provider.decisionModel.mockReset());

describe("memory decision about a message", () => {
  it.each(["", "   ", "\n \t"])(
    "finds nothing lasting in the blank message %j, and asks no one",
    async (message) => {
      const { requests } = decides(() => SURE);
      expect(await runSpecialist((userId) => isLasting(userId, message))).toBe(
        false
      );
      expect(requests()).toEqual([]);
    }
  );

  it.each([
    [SURE, true],
    [UNLIKELY, false],
  ])(
    "finds a message lasting or not as the decision model says, for a probability of %s",
    async (probability, lasting) => {
      const { requests } = decides(() => probability);
      expect(
        await runSpecialist((userId) => isLasting(userId, "Aku kelas 12."))
      ).toBe(lasting);
      expect(Arr.map(requests(), (request) => request.state)).toEqual([
        [{ text: "Aku kelas 12.", type: "text" }],
      ]);
    }
  );

  it("fails with the typed error and the gateway's routing facts when the decision cannot be made, and keeps no text in it", async () => {
    provider.decisionModel.mockReturnValue(unavailable);
    // The action returns a plain value, as Convex requires of one.
    const failure = await runSpecialist((userId) =>
      Effect.flip(isLasting(userId, "Kelas 12 IPA.")).pipe(
        Effect.map(({ gateway, operation, rejected }) => ({
          operation,
          reason: gateway?.reason,
          rejected,
          status: gateway?.status,
        }))
      )
    );
    expect(failure).toEqual({
      operation: "judge",
      reason: "unavailable",
      rejected: false,
      status: 503,
    });
  });
});

/** A decision model that finds the first candidates private or not the learner's own note, as the test says, by the position of the candidate. */
function judging({
  notOwn = [],
  privates = [],
}: {
  readonly notOwn?: readonly number[];
  readonly privates?: readonly number[];
}) {
  return decides((judgment, index) => {
    const yes =
      judgment === "private"
        ? Arr.contains(privates, index)
        : !Arr.contains(notOwn, index);
    return yes ? SURE : UNLIKELY;
  });
}

describe("memory decision about candidates", () => {
  it.effect(
    "keeps the candidates that are the learner's own note and hold nothing private, in their order, and judges both about all of them in one request",
    () =>
      Effect.gen(function* () {
        const { requests } = judging({ privates: [1] });
        expect(yield* judgeCandidates(candidates)).toEqual([
          candidates[0],
          candidates[2],
        ]);
        const [request, ...others] = requests();
        expect(others).toEqual([]);
        expect(request?.state).toEqual([
          {
            text: "Text 1:\nNote: Kelas 12.\nQuote: aku kelas 12",
            type: "text",
          },
          {
            text: "Text 2:\nNote: Nomor telepon 0812 3456 7890.\nQuote: nomor teleponku 0812 3456 7890",
            type: "text",
          },
          {
            text: "Text 3:\nNote: Lernt mit Beispielen.\nQuote: ich lerne mit Beispielen",
            type: "text",
          },
        ]);
        expect(Rec.keys(request?.questions ?? {})).toEqual([
          "ownNote.0",
          "ownNote.1",
          "ownNote.2",
          "private.0",
          "private.1",
          "private.2",
        ]);
      }).pipe(Effect.provide(GatewayTest))
  );

  it.effect(
    "drops a candidate that is not the learner's own note, whatever its words, and keeps the others",
    () =>
      Effect.gen(function* () {
        judging({ notOwn: [0, 2] });
        expect(yield* judgeCandidates(candidates)).toEqual([candidates[1]]);
      }).pipe(Effect.provide(GatewayTest))
  );

  it.effect(
    "drops a candidate that is private or not the learner's own note, one or both",
    () =>
      Effect.gen(function* () {
        judging({ notOwn: [0, 1], privates: [1, 2] });
        expect(yield* judgeCandidates(candidates)).toEqual([]);
      }).pipe(Effect.provide(GatewayTest))
  );

  it.effect(
    "keeps all of the candidates when the decision model finds each the learner's own note and nothing private",
    () =>
      Effect.gen(function* () {
        judging({});
        expect(yield* judgeCandidates(candidates)).toEqual(candidates);
      }).pipe(Effect.provide(GatewayTest))
  );

  it.effect(
    "fails with the typed error when the decision cannot be made, so that no candidate is kept",
    () =>
      Effect.gen(function* () {
        provider.decisionModel.mockReturnValue(unavailable);
        expect(yield* Effect.flip(judgeCandidates(candidates))).toMatchObject({
          _tag: "NinaMemoryError",
          gateway: { reason: "unavailable", status: 503 },
          operation: "judge",
          rejected: false,
        });
      }).pipe(Effect.provide(GatewayTest))
  );
});
