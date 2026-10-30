import { beforeEach, describe, expect, it } from "@effect/vitest";
import { upcomingEvents } from "@repo/backend/confect/connectors/google/calendar";
import { FetchClient } from "@repo/utilities/http/client";
import { encodeJsonText } from "@repo/utilities/json";
import { DateTime, Effect } from "effect";
import { FetchHttpClient } from "effect/http";

/** The fetch that Effect's client calls in place of the global one. */
const fetcher = vi.fn<typeof fetch>();

/** One JSON answer of Google. */
const json = (status: number, body: object) =>
  new Response(encodeJsonText(body), {
    headers: { "content-type": "application/json" },
    status,
  });

/** Runs one Google read through the stubbed fetch. */
const google = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.provide(FetchClient),
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );

/** The epoch milliseconds of an ISO instant. */
const at = (iso: string) => DateTime.toEpochMillis(DateTime.makeUnsafe(iso));

const NOW = at("2026-10-26T00:00:00Z");

describe("connectors/google/calendar", () => {
  beforeEach(() => {
    fetcher.mockReset();
  });

  it.effect(
    "reads the coming events, each occurrence apart, without a cancelled one or one without a time",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(
          json(200, {
            items: [
              {
                end: { dateTime: "2026-10-28T09:00:00Z" },
                id: "e1",
                start: { dateTime: "2026-10-28T08:00:00Z" },
                summary: "Ujian",
              },
              { end: {}, id: "e2", start: {} },
              {
                end: { date: "2026-10-30" },
                id: "e3",
                start: { date: "2026-10-29" },
              },
              {
                end: { dateTime: "2026-10-28T09:00:00Z" },
                id: "e4",
                start: { dateTime: "2026-10-28T08:00:00Z" },
                status: "cancelled",
              },
            ],
          })
        );
        const events = yield* google(upcomingEvents("access", NOW));
        expect(events).toEqual([
          {
            allDay: false,
            end: at("2026-10-28T09:00:00Z"),
            eventId: "e1",
            start: at("2026-10-28T08:00:00Z"),
            title: "Ujian",
          },
          {
            allDay: true,
            end: at("2026-10-30T00:00:00Z"),
            eventId: "e3",
            start: at("2026-10-29T00:00:00Z"),
            title: "",
          },
        ]);
        const url = new URL(String(fetcher.mock.calls[0]?.[0]));
        expect(url.searchParams.get("timeMin")).toBe(
          "2026-10-26T00:00:00.000Z"
        );
        expect(url.searchParams.get("timeMax")).toBe(
          "2026-11-09T00:00:00.000Z"
        );
      })
  );

  it.effect(
    "fails a read of the calendar as revoked, refused, unreached, or invalid",
    () =>
      Effect.gen(function* () {
        const read = () => upcomingEvents("access", NOW);
        fetcher.mockResolvedValueOnce(json(401, {}));
        expect(yield* google(read()).pipe(Effect.flip)).toMatchObject({
          reason: "revoked",
        });
        fetcher.mockResolvedValueOnce(json(503, {}));
        expect(yield* google(read()).pipe(Effect.flip)).toMatchObject({
          reason: "refused",
          status: 503,
        });
        fetcher.mockRejectedValueOnce(new TypeError("fetch failed"));
        expect(yield* google(read()).pipe(Effect.flip)).toMatchObject({
          reason: "unreached",
        });
        fetcher.mockResolvedValueOnce(
          new Response("not json", { status: 200 })
        );
        expect(yield* google(read()).pipe(Effect.flip)).toMatchObject({
          reason: "invalid",
        });
      })
  );
});
