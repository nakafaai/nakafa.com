import { beforeEach, describe, expect, it } from "@effect/vitest";
import { readForm } from "@repo/backend/confect/connectors/google/forms";
import { FetchClient } from "@repo/utilities/http/client";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";

/** The fetch that Effect's client calls in place of the global one. */
const fetcher = vi.fn<typeof fetch>();

/** One JSON answer of Google. */
const json = (status: number, body: object) =>
  new Response(encodeJsonText(body), {
    headers: { "content-type": "application/json" },
    status,
  });

/** Reads one form through the stubbed fetch. */
const read = () =>
  readForm("token", "form/1").pipe(
    Effect.provide(FetchClient),
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );

describe("connectors/google/forms", () => {
  beforeEach(() => {
    fetcher.mockReset();
  });

  it.effect("reads each question with its key, and skips what is no question", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(
        json(200, {
          items: [
            { title: "Bagian 1" },
            {
              description: "Pilih satu.",
              questionItem: {
                question: {
                  choiceQuestion: {
                    options: [{ value: "3" }, { value: "4" }, { isOther: true }],
                    type: "RADIO",
                  },
                  grading: { correctAnswers: { answers: [{ value: "4" }] } },
                },
              },
              title: "2 + 2?",
            },
            {
              questionItem: {
                question: {
                  choiceQuestion: {
                    options: [{ value: "Ya" }, { value: "Tidak" }],
                    type: "DROP_DOWN",
                  },
                },
              },
              title: "Sudah belajar?",
            },
            {
              questionItem: {
                question: {
                  choiceQuestion: {
                    options: [{ value: "A" }, { value: "B" }],
                    type: "CHECKBOX",
                  },
                },
              },
              title: "Pilih semua.",
            },
            { questionItem: { question: {} }, title: "Jelaskan." },
          ],
        })
      );

      expect(yield* read()).toEqual([
        {
          answer: 1,
          explanation: "",
          figures: [],
          number: 1,
          options: ["3", "4"],
          prompt: "2 + 2?\nPilih satu.",
        },
        {
          answer: null,
          explanation: "",
          figures: [],
          number: 2,
          options: ["Ya", "Tidak"],
          prompt: "Sudah belajar?",
        },
        {
          answer: null,
          explanation: "",
          figures: [],
          number: 3,
          options: [],
          prompt: "Pilih semua.",
        },
        {
          answer: null,
          explanation: "",
          figures: [],
          number: 4,
          options: [],
          prompt: "Jelaskan.",
        },
      ]);
      const [url, init] = fetcher.mock.calls[0] ?? [];
      expect(String(url)).toBe(
        "https://forms.googleapis.com/v1/forms/form%2F1"
      );
      expect(new Headers(init?.headers).get("authorization")).toBe(
        "Bearer token"
      );
    })
  );

  it.effect("answers none for a form without items", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(json(200, {}));
      expect(yield* read()).toEqual([]);
    })
  );

  it.effect("tells a revoked token, a refused form, and an unreadable answer apart", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(json(401, {}));
      expect(yield* Effect.flip(read())).toMatchObject({
        reason: "revoked",
        status: 401,
      });
      fetcher.mockResolvedValueOnce(json(403, {}));
      expect(yield* Effect.flip(read())).toMatchObject({
        reason: "refused",
        status: 403,
      });
      fetcher.mockResolvedValueOnce(new Response("not json"));
      expect(yield* Effect.flip(read())).toMatchObject({ reason: "invalid" });
      fetcher.mockRejectedValueOnce(new Error("offline"));
      expect(yield* Effect.flip(read())).toMatchObject({ reason: "unreached" });
    })
  );
});
