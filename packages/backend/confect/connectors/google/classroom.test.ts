import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  courseStudents,
  courseWork,
  teacherCourses,
} from "@repo/backend/confect/connectors/google/classroom";
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

describe("connectors/google/classroom", () => {
  beforeEach(() => {
    fetcher.mockReset();
  });

  it.effect(
    "fails a read of Classroom as revoked, refused, unreached, or invalid",
    () =>
      Effect.gen(function* () {
        const read = () => teacherCourses("access");
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
        fetcher.mockResolvedValueOnce(
          new Response(
            new ReadableStream({
              start: (controller) => controller.error(new Error("cut")),
            }),
            { status: 200 }
          )
        );
        expect(yield* google(read()).pipe(Effect.flip)).toMatchObject({
          reason: "unreached",
        });
      })
  );

  it.effect(
    "reads a teacher's courses, a course's students, and its published coursework with a deadline",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(
          json(200, {
            courses: [
              { id: "c1", name: "Fisika", section: "X-1" },
              { id: "c2", name: "Kimia" },
            ],
          })
        );
        expect(yield* google(teacherCourses("access"))).toEqual([
          { courseId: "c1", name: "Fisika", section: "X-1" },
          { courseId: "c2", name: "Kimia", section: null },
        ]);
        fetcher.mockResolvedValueOnce(json(200, {}));
        expect(yield* google(teacherCourses("access"))).toEqual([]);
        fetcher.mockResolvedValueOnce(
          json(200, { students: [{ userId: "s1" }, { userId: "s2" }] })
        );
        expect(yield* google(courseStudents("access", "c1"))).toBe(2);
        fetcher.mockResolvedValueOnce(json(200, {}));
        expect(yield* google(courseStudents("access", "c2"))).toBe(0);
        fetcher.mockResolvedValueOnce(
          json(200, {
            courseWork: [
              {
                description: "Kerjakan",
                dueDate: { day: 1, month: 11, year: 2026 },
                id: "w1",
                maxPoints: 100,
                state: "PUBLISHED",
                title: "Latihan",
              },
              {
                dueDate: { day: 2, month: 11, year: 2026 },
                dueTime: { hours: 7 },
                id: "w2",
                title: "Kuis",
              },
              {
                dueDate: { day: 2, month: 11, year: 2026 },
                id: "w3",
                state: "DRAFT",
                title: "Draf",
              },
              { id: "w4", title: "Tanpa tenggat" },
            ],
          })
        );
        expect(yield* google(courseWork("access", "c1"))).toEqual([
          {
            deadline: at("2026-11-01T23:59:00Z"),
            points: 100,
            text: "Kerjakan",
            title: "Latihan",
            workId: "w1",
          },
          {
            deadline: at("2026-11-02T07:00:00Z"),
            points: 0,
            text: "",
            title: "Kuis",
            workId: "w2",
          },
        ]);
        fetcher.mockResolvedValueOnce(json(200, {}));
        expect(yield* google(courseWork("access", "c2"))).toEqual([]);
      })
  );
});
