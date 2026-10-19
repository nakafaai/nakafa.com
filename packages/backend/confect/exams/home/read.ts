import type { GenericId } from "@confect/core";
import type {
  ExamSittingsDoc,
  TenantUnitsDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { examAuthority } from "@repo/backend/confect/exams/authority";
import { examSummary } from "@repo/backend/confect/exams/exam";
import {
  sittingAuthority,
  withExam,
} from "@repo/backend/confect/exams/sittings/authority";
import { TENANT_UNIT_LIMIT } from "@repo/backend/confect/exams/sittings/mine";
import { sittingViews } from "@repo/backend/confect/exams/sittings/view";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { unitAuthority } from "@repo/backend/confect/tenancy/authority";
import { Array as Arr, Clock, Duration, Effect, Order } from "effect";

/**
 * The most sittings that one tile of the school home lists. Each unit is read for at most this many
 * rooms of each state, and the earliest ones of all units are kept, so the bound never hides a room
 * that the tile would show.
 */
const HOME_ROWS = 5;

/** The most drafts that the school home lists: the viewer's newest exams, which the viewer may still edit. */
const HOME_DRAFTS = 4;

/** How far ahead the school home looks for a scheduled sitting, in milliseconds. */
const UPCOMING_WINDOW_MS = Duration.toMillis(Duration.days(14));

/** The unit action that opens the rooms of an exam. The viewers of rooms are the viewers of sittings. */
const ROOMS_ACTION = "exam.rooms";

/** The sittings in the order the home lists them: the earliest opening first. */
const byOpening = Order.mapInput(
  Order.Number,
  (sitting: Pick<ExamSittingsDoc, "opensAt">) => sitting.opensAt
);

/**
 * Whether the viewer may open the rooms of a unit, which the viewers of rooms hold. The home reads
 * the rooms of the units that pass, so its reads stay on the units the viewer can see, and each room
 * is still decided by its own sitting authority.
 */
const watchesRooms = Effect.fn("exams.home.watchesRooms")(function* (
  unit: TenantUnitsDoc
) {
  const actions = yield* unitAuthority.allowed(unit);
  return Arr.contains(actions, ROOMS_ACTION);
});

/** The rooms of one unit that run now, which are the open ones, in their opening order. */
const openRows = Effect.fn("exams.home.openRows")(function* (
  unitId: ExamSittingsDoc["unitId"]
) {
  return yield* (yield* DatabaseReader)
    .table("examSittings")
    .index("by_unitId_and_state_and_opensAt", (query) =>
      query.eq("unitId", unitId).eq("state", "open")
    )
    .take(HOME_ROWS)
    .pipe(Effect.orDie);
});

/**
 * The rooms of one unit that open within the window from now, in their opening order. The window
 * includes its two ends, so a room that opens exactly fourteen days from now is listed.
 */
const upcomingRows = Effect.fn("exams.home.upcomingRows")(function* (
  unitId: ExamSittingsDoc["unitId"],
  now: number
) {
  return yield* (yield* DatabaseReader)
    .table("examSittings")
    .index("by_unitId_and_state_and_opensAt", (query) =>
      query
        .eq("unitId", unitId)
        .eq("state", "scheduled")
        .gte("opensAt", now)
        .lte("opensAt", now + UPCOMING_WINDOW_MS)
    )
    .take(HOME_ROWS)
    .pipe(Effect.orDie);
});

/** Whether the viewer's sitting view allows the room, which the room's own authority decides. */
const canView = Effect.fn("exams.home.canView")(function* (
  row: ExamSittingsDoc
) {
  const actions = yield* withExam(row).pipe(
    Effect.flatMap(sittingAuthority.allowed)
  );
  return Arr.contains(actions, "sitting.view");
});

/**
 * The first rooms of the candidates that the viewer may view, earliest opening first, at most
 * `HOME_ROWS`. Each candidate is decided by its own sitting authority, so no room reaches a viewer
 * who may not see it.
 */
const firstViewable = Effect.fn("exams.home.firstViewable")(function* (
  rows: readonly ExamSittingsDoc[]
) {
  const viewable = yield* Effect.filter(rows, canView);
  return Arr.take(Arr.sort(viewable, byOpening), HOME_ROWS);
});

/**
 * The exams of one school that the author created and may still edit, newest first. The author is
 * the account that `exams.create` records, so a draft is the author's own exam. The index reads the
 * newest exams of the author in order, so the read never walks every exam of the school.
 */
const draftsOf = Effect.fn("exams.home.drafts")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  author: GenericId.GenericId<"users">
) {
  const rows = yield* (yield* DatabaseReader)
    .table("exams")
    .index(
      "by_tenantId_and_createdBy",
      (query) => query.eq("tenantId", tenantId).eq("createdBy", author),
      "desc"
    )
    .take(HOME_DRAFTS)
    .pipe(Effect.orDie);
  const editable = yield* Effect.filter(rows, (row) =>
    examAuthority
      .allowed(row)
      .pipe(Effect.map((actions) => Arr.contains(actions, "exam.edit")))
  );
  return Arr.map(editable, examSummary);
});

/**
 * The school home's exam reads for the caller, in one bounded call. Every read is an index read
 * with a small limit over the school's active units, and each room and draft is decided by its own
 * authority before it is returned. A caller who holds no room or exam action gets three empty lists.
 */
export const readHome = Effect.fn("exams.home.read")(function* () {
  const member = yield* Member;
  const { appUser } = yield* requireAuth().pipe(Effect.orDie);
  const reader = yield* DatabaseReader;
  const now = yield* Clock.currentTimeMillis;
  const units = yield* reader
    .table("tenantUnits")
    .index("by_tenantId_and_status", (query) =>
      query.eq("tenantId", member.tenant._id).eq("status", "active")
    )
    .take(TENANT_UNIT_LIMIT)
    .pipe(Effect.orDie);
  const watched = yield* Effect.filter(units, watchesRooms);
  const running = Arr.flatten(
    yield* Effect.forEach(watched, (unit) => openRows(unit._id))
  );
  const upcoming = Arr.flatten(
    yield* Effect.forEach(watched, (unit) => upcomingRows(unit._id, now))
  );
  const live = yield* firstViewable(
    Arr.filter(running, (row) => row.closesAt > now)
  );
  const next = yield* firstViewable(upcoming);
  return {
    drafts: yield* draftsOf(member.tenant._id, appUser._id),
    live: yield* sittingViews(live),
    next: yield* sittingViews(next),
  };
});
