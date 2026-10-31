import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { nf } from "@repo/backend/test/editor";
import {
  dashboardOf,
  deviceOf,
  enterOk,
  mentions,
  openedSitting,
} from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, DateTime, Effect } from "effect";

const { signal, signals } = refs.public.exams.sittings;

describe("exams/sittings signal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "records the student's own signal, and the dashboard shows the student as away",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        yield* fixture.as("student").mutation(signal, {
          attemptId: entered.attempt,
          deviceId: deviceOf(1),
          kind: "exit",
          slug: nf,
        });
        const page = yield* dashboardOf(fixture, made.id);
        expect(page.attempts.page).toMatchObject([
          {
            away: true,
            latestSignal: { kind: "exit" },
            mascot: expect.anything(),
            name: "Student",
            state: "inProgress",
          },
        ]);
        expect(mentions(page.attempts, made.token)).toBe(false);
        expect(mentions(page.sitting, made.token)).toBe(false);
      })
  );

  it.effect(
    "refuses a signal from a device that does not own the attempt, and from another member",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        const otherDevice = yield* fixture
          .as("student")
          .mutation(signal, {
            attemptId: entered.attempt,
            deviceId: deviceOf(2),
            kind: "blur",
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(otherDevice).toMatchObject({ _tag: "SecondDevice" });
        const otherMember = yield* fixture
          .as("teacher")
          .mutation(signal, {
            attemptId: entered.attempt,
            deviceId: deviceOf(1),
            kind: "blur",
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(otherMember).toMatchObject({ _tag: "NotInSitting" });
      })
  );

  it.effect(
    "records a disconnect when the device lost its connection, kept within the attempt, and every other signal at the server's time",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        const startedAt = DateTime.toEpochMillis(DateTime.nowUnsafe());
        const send = (kind: "disconnect" | "return", since: number) =>
          fixture.as("student").mutation(signal, {
            attemptId: entered.attempt,
            deviceId: deviceOf(1),
            kind,
            since,
            slug: nf,
          });
        vi.setSystemTime(startedAt + 60_000);
        yield* send("disconnect", startedAt + 20_000);
        yield* send("return", startedAt + 20_000);
        vi.setSystemTime(startedAt + 120_000);
        yield* send("disconnect", startedAt - 5000);
        vi.setSystemTime(startedAt + 180_000);
        yield* send("disconnect", startedAt + 999_000);
        const recorded = yield* fixture.as("teacher").query(signals, {
          attemptId: entered.attempt,
          paginationOpts: { cursor: null, numItems: 10 },
          sittingId: made.id,
          slug: nf,
        });
        expect(
          Arr.map(recorded.page, (row) => [row.kind, row.at - startedAt])
        ).toStrictEqual([
          ["disconnect", 180_000],
          ["return", 60_000],
          ["disconnect", 20_000],
          ["disconnect", 0],
        ]);
      })
  );
});
