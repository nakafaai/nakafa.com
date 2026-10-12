import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  isLasting,
  withoutPrivate,
} from "@repo/backend/confect/nina/memory/decision";
import type { NinaMemoryCandidate } from "@repo/backend/confect/nina/memory.spec";
import { decides, GatewayTest, provider } from "@repo/backend/test/gateway";
import { runSpecialist } from "@repo/backend/test/nina/specialist";
import { APICallError } from "ai";
import { Experimental_DecisionMockModelV4 as DecisionMockModel } from "ai/test";
import { Array as Arr, Effect } from "effect";

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

describe("memory decision about candidates", () => {
  it.effect(
    "keeps the candidates in which the decision model finds nothing private, in their order, and judges all of them in one request",
    () =>
      Effect.gen(function* () {
        const { requests } = decides((_, index) =>
          index === 1 ? SURE : UNLIKELY
        );
        expect(yield* withoutPrivate(candidates)).toEqual([
          candidates[0],
          candidates[2],
        ]);
        const [request, ...others] = requests();
        expect(others).toEqual([]);
        expect(request?.state).toEqual([
          { text: "Text 1:\nKelas 12.\naku kelas 12", type: "text" },
          {
            text: "Text 2:\nNomor telepon 0812 3456 7890.\nnomor teleponku 0812 3456 7890",
            type: "text",
          },
          {
            text: "Text 3:\nLernt mit Beispielen.\nich lerne mit Beispielen",
            type: "text",
          },
        ]);
      }).pipe(Effect.provide(GatewayTest))
  );

  it.effect.each([
    [UNLIKELY, 3],
    [SURE, 0],
  ])(
    "keeps all of the candidates or none of them when the decision model says so, for a probability of %s",
    ([probability, kept]) =>
      Effect.gen(function* () {
        decides(() => probability);
        expect(yield* withoutPrivate(candidates)).toHaveLength(kept);
      }).pipe(Effect.provide(GatewayTest))
  );

  it.effect(
    "fails with the typed error when the decision cannot be made, so that no candidate is kept",
    () =>
      Effect.gen(function* () {
        provider.decisionModel.mockReturnValue(unavailable);
        expect(yield* Effect.flip(withoutPrivate(candidates))).toMatchObject({
          _tag: "NinaMemoryError",
          gateway: { reason: "unavailable", status: 503 },
          operation: "judge",
          rejected: false,
        });
      }).pipe(Effect.provide(GatewayTest))
  );
});
