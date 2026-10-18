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
import { Effect } from "effect";

const { signal } = refs.public.exams.sittings;

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
});
