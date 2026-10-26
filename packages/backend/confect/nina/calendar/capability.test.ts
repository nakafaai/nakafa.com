import { Ref } from "@confect/core";
import { QueryRunner, RegisteredFunction } from "@confect/server";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import { calendarCapability } from "@repo/backend/confect/nina/calendar/capability";
import { runCalendar } from "@repo/backend/confect/nina/calendar/tool";
import type { Held } from "@repo/backend/confect/nina/capability/held";
import { GatewayTest } from "@repo/backend/test/gateway";
import {
  finalAnswer,
  playTurn,
  toolCall,
} from "@repo/backend/test/nina/capability";
import { createMemoryTest } from "@repo/backend/test/nina/memory";
import { specialistRequest } from "@repo/backend/test/nina/specialist";
import { encodeJsonText } from "@repo/utilities/json";
import { MockLanguageModelV4 } from "ai/test";
import {
  DateTime,
  Effect,
  type Layer,
  MutableHashMap,
  MutableRef,
  Option,
} from "effect";

vi.mock("@repo/backend/confect/nina/calendar/tool", async (load) => {
  const actual =
    await load<typeof import("@repo/backend/confect/nina/calendar/tool")>();
  return { ...actual, runCalendar: vi.fn(actual.runCalendar) };
});

const storeEvents = Ref.getFunctionReference(
  refs.internal.connectors.sync.storeEvents
);

/** The epoch milliseconds of an ISO instant. */
const at = (iso: string) => DateTime.toEpochMillis(DateTime.makeUnsafe(iso));

const NOW = at("2026-10-26T06:00:00Z");

/**
 * Plays a model that reads the calendar of the fixture's learner once for the
 * coming week, and answers, in a turn whose context says the learner connected
 * Calendar unless `calendar` says otherwise. `read` replaces how the run reads
 * the mirror, to make that read fail as the platform does.
 */
async function read(
  f: Awaited<ReturnType<typeof createMemoryTest>>,
  {
    calendar = true,
    read: reader,
  }: {
    readonly calendar?: boolean;
    readonly read?: Layer.Layer<QueryRunner.QueryRunner>;
  } = {}
) {
  const found: Held = MutableHashMap.empty();
  const model = new MockLanguageModelV4({
    doGenerate: [toolCall("calendar", { days: 7 }), finalAnswer],
  });
  const played = await f.t.action((ctx) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const turn = playTurn({
          context: { ...specialistRequest.context, calendar },
          held: found,
          model,
          prompt: "What exams do I have this week?",
          registry: { calendar: calendarCapability },
          userId: f.identity.userId,
        });
        return yield* reader === undefined
          ? turn
          : turn.pipe(Effect.provide(reader));
      }).pipe(
        Effect.provide([
          GatewayTest,
          RegisteredFunction.actionLayer(schema, ctx),
        ])
      )
    )
  );
  return { ...played, found };
}

/** A Calendar connection of the fixture's learner, with the events its sync stored. */
async function connectCalendar(
  f: Awaited<ReturnType<typeof createMemoryTest>>,
  events: readonly {
    readonly allDay: boolean;
    readonly end: number;
    readonly eventId: string;
    readonly start: number;
    readonly title: string;
  }[]
) {
  const connectionId = await f.t.mutation((ctx) =>
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
  await f.t.mutation(storeEvents, { connectionId, events });
}

describe("the calendar capability in a turn", () => {
  beforeEach(() => {
    // Only the clock is fixed: the turn's own timers must run.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("hands the next step the week's events in UTC, and leaves none of their titles in the result the conversation stores", async () => {
    const f = await createMemoryTest();
    await connectCalendar(f, [
      {
        allDay: false,
        end: at("2026-10-28T09:00:00Z"),
        eventId: "exam",
        start: at("2026-10-28T08:00:00Z"),
        title: "Ujian Fisika",
      },
      {
        allDay: true,
        end: at("2026-10-30T00:00:00Z"),
        eventId: "holiday",
        start: at("2026-10-29T00:00:00Z"),
        title: "",
      },
      {
        allDay: false,
        end: at("2026-11-20T09:00:00Z"),
        eventId: "later",
        start: at("2026-11-20T08:00:00Z"),
        title: "Bulan depan",
      },
    ]);
    const { found, logged, result } = await read(f);
    expect(result[0]).not.toHaveProperty("outcome");
    expect(encodeJsonText(result)).not.toContain("Ujian");
    const words = Option.getOrThrow(
      MutableHashMap.get(found, {
        toolCallId: "capability",
        toolName: "calendar",
      })
    );
    expect(words).toContain(
      "- 2026-10-28T08:00:00.000Z to 2026-10-28T09:00:00.000Z: Ujian Fisika"
    );
    expect(words).toContain(
      "- all day from 2026-10-29 to 2026-10-30: (no title)"
    );
    expect(words).not.toContain("Bulan depan");
    expect(MutableRef.get(logged)).toEqual([]);
  });

  it("says that the window holds no event, and marks the run as empty", async () => {
    const f = await createMemoryTest();
    await connectCalendar(f, []);
    const { found, result } = await read(f);
    expect(result).toMatchObject([{ outcome: "empty" }]);
    expect(MutableHashMap.size(found)).toBe(0);
  });

  it("refuses a call under the policy of a turn whose learner has not connected Calendar, without reading it", async () => {
    vi.mocked(runCalendar).mockClear();
    const f = await createMemoryTest();
    const { result } = await read(f, { calendar: false });
    expect(result).toMatchObject([{ outcome: "denied" }]);
    expect(runCalendar).not.toHaveBeenCalled();
  });

  it("tells Nina it could not read the calendar, by phase, when the read is rejected or the run dies", async () => {
    const f = await createMemoryTest();
    const rejected = await read(f, {
      read: QueryRunner.layer(() =>
        Promise.reject(new Error("Read failed for Ujian Fisika"))
      ),
    });
    expect(rejected.result).toMatchObject([{ outcome: "failed" }]);
    expect(MutableRef.get(rejected.logged)).toEqual([
      [
        "Nina capability failed",
        expect.objectContaining({ capability: "calendar", phase: "read" }),
      ],
    ]);
    vi.mocked(runCalendar).mockReturnValueOnce(
      Effect.die(new Error("Private storage detail"))
    );
    const died = await read(f);
    expect(MutableRef.get(died.logged)).toEqual([
      [
        "Nina capability failed",
        expect.objectContaining({ capability: "calendar", phase: "run" }),
      ],
    ]);
    expect(encodeJsonText(died.result)).not.toContain("Private storage detail");
  });
});
