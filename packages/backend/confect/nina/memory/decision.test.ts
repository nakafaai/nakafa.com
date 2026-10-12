import { afterEach, describe, expect, it } from "@effect/vitest";
import { noteText } from "@repo/backend/confect/nina/judgment/note";
import {
  isLasting,
  judgeCandidates,
} from "@repo/backend/confect/nina/memory/decision";
import type { NinaMemoryCandidate } from "@repo/backend/confect/nina/memory.spec";
import {
  askedOf,
  decides,
  decidesTogether,
  GatewayTest,
  provider,
  textOf,
} from "@repo/backend/test/gateway";
import { runSpecialist } from "@repo/backend/test/nina/specialist";
import { APICallError } from "ai";
import { Experimental_DecisionMockModelV4 as DecisionMockModel } from "ai/test";
import { Array as Arr, Effect, MutableRef, Order, Record as Rec } from "effect";

/** A probability well above every threshold, and one well below. */
const SURE = 0.99;
const UNLIKELY = 0.01;

/** A decision the gateway cannot answer, with detail that must never travel on. */
const refusal = new APICallError({
  isRetryable: false,
  message: "Private provider detail",
  requestBodyValues: { state: "Kelas 12 IPA." },
  statusCode: 503,
  url: "https://ai-gateway.convex.dev/alpha/decisions",
});
const unavailable = new DecisionMockModel({
  doDecide: () => Promise.reject(refusal),
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

/** A decision model that finds the candidates it is given private, or not the learner's own note, as the test says. */
function judging({
  notOwn = [],
  privates = [],
}: {
  readonly notOwn?: readonly (typeof candidates)[number][];
  readonly privates?: readonly (typeof candidates)[number][];
}) {
  const notOwnNotes = Arr.map(notOwn, noteText);
  const privateNotes = Arr.map(privates, noteText);
  return decides((judgment, text) => {
    const yes =
      judgment === "private"
        ? Arr.contains(privateNotes, text)
        : !Arr.contains(notOwnNotes, text);
    return yes ? SURE : UNLIKELY;
  });
}

describe("memory decision about candidates", () => {
  it.effect(
    "keeps the candidates that are the learner's own note and hold nothing private, in their order, and asks about each one in a request of its own",
    () =>
      Effect.gen(function* () {
        const { requests } = judging({ privates: [candidates[1]] });
        expect(yield* judgeCandidates(candidates)).toEqual([
          candidates[0],
          candidates[2],
        ]);
        // One request for each candidate, as its sentence with its quote, and
        // each asks both judgments.
        expect(Arr.sort(Arr.map(requests(), textOf), Order.String)).toEqual(
          Arr.sort(Arr.map(candidates, noteText), Order.String)
        );
        for (const request of requests()) {
          expect(askedOf(request)).toEqual(["ownNote", "private"]);
        }
      }).pipe(Effect.provide(GatewayTest))
  );

  it.effect(
    "asks about all the candidates at the same time, so that none waits for another",
    () =>
      Effect.gen(function* () {
        // No request is answered before every candidate has its request open,
        // and each is the learner's own note with nothing private in it.
        const opened = decidesTogether(Arr.length(candidates), (judgment) =>
          judgment === "private" ? UNLIKELY : SURE
        );
        expect(yield* judgeCandidates(candidates)).toEqual(candidates);
        expect(MutableRef.get(opened)).toBe(Arr.length(candidates));
      }).pipe(Effect.provide(GatewayTest))
  );

  it.effect(
    "drops a candidate that is not the learner's own note, whatever its words, and keeps the others",
    () =>
      Effect.gen(function* () {
        judging({ notOwn: [candidates[0], candidates[2]] });
        expect(yield* judgeCandidates(candidates)).toEqual([candidates[1]]);
      }).pipe(Effect.provide(GatewayTest))
  );

  it.effect(
    "drops a candidate that is private or not the learner's own note, one or both",
    () =>
      Effect.gen(function* () {
        judging({
          notOwn: [candidates[0], candidates[1]],
          privates: [candidates[1], candidates[2]],
        });
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

  it.effect("asks nothing about no candidate", () =>
    Effect.gen(function* () {
      expect(yield* judgeCandidates([])).toEqual([]);
      expect(provider.decisionModel).not.toHaveBeenCalled();
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

  it.effect(
    "fails with the typed error, and keeps none of the candidates, when the request of only one of them cannot be answered",
    () =>
      Effect.gen(function* () {
        // The request about the second candidate is refused. The others would
        // be answered, and their candidates are the learner's own notes.
        provider.decisionModel.mockReturnValue(
          new DecisionMockModel({
            doDecide: (request) =>
              textOf(request) === noteText(candidates[1])
                ? Promise.reject(refusal)
                : Promise.resolve({
                    answers: Rec.map(request.questions, (_, judgment) => ({
                      probability: judgment === "private" ? UNLIKELY : SURE,
                      type: "boolean" as const,
                    })),
                    warnings: [],
                  }),
          })
        );
        expect(yield* Effect.flip(judgeCandidates(candidates))).toMatchObject({
          _tag: "NinaMemoryError",
          gateway: { reason: "unavailable", status: 503 },
          operation: "judge",
        });
      }).pipe(Effect.provide(GatewayTest))
  );
});
