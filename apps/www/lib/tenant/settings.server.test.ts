// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import access from "@repo/backend/confect/_generated/refs/access";
import identity from "@repo/backend/confect/_generated/refs/identity";
import integrations from "@repo/backend/confect/_generated/refs/integrations";
import journal from "@repo/backend/confect/_generated/refs/journal";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Option, Schema } from "effect";
import {
  auditHandler,
  clientsHandler,
  cohortHandler,
  cohortsHandler,
  invitesHandler,
  membersHandler,
  periodsHandler,
  rolesHandler,
  studentsHandler,
  unitsHandler,
} from "@/lib/tenant/settings.server";

/** A read that the test backend fails with, so a first screen answers no value for it. */
class ReadFailed extends Schema.TaggedError<ReadFailed>()("ReadFailed", {
  cause: Schema.Unknown,
}) {}

process.env.VITE_CONVEX_URL = "https://example.convex.cloud";

const SLUG = Schema.decodeSync(TenantSlug)("harapan");
const UNIT = Schema.decodeUnknownSync(Id("tenantUnits"))("unit-1");
const COHORT = Schema.decodeUnknownSync(Id("tenantCohorts"))("cohort-1");
const PERIOD = Schema.decodeUnknownSync(Id("tenantPeriods"))("period-1");

const mocks = vi.hoisted(() => ({
  preloadConfectQuery:
    vi.fn<
      (
        ref: unknown,
        args: unknown,
        token: unknown
      ) => Effect.Effect<unknown, unknown>
    >(),
  readRequestToken: vi.fn<() => Effect.Effect<string | undefined, never>>(),
  setResponseHeader: vi.fn<(name: string, value: string) => void>(),
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://harapan.nakafa.com/"),
  setResponseHeader: mocks.setResponseHeader,
}));

vi.mock("@/lib/auth/session.server", () => ({
  readRequestToken: mocks.readRequestToken,
}));

vi.mock("@/lib/data/preload.server", () => ({
  preloadConfectQuery: mocks.preloadConfectQuery,
}));

/** A paginated first page as the Confect query returns it. */
const page = (items: readonly unknown[]) => ({
  continueCursor: "cursor",
  isDone: false,
  page: items,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readRequestToken.mockReturnValue(Effect.succeed("token-settings"));
  mocks.preloadConfectQuery.mockImplementation(() => Effect.succeed(page([])));
});

describe("settings list first screens", () => {
  const lists = [
    ["students", studentsHandler, identity.logins.list],
    ["roles", rolesHandler, access.grants.list],
    ["members", membersHandler, tenancy.roster.members],
    ["invites", invitesHandler, tenancy.invites.list],
    ["clients", clientsHandler, integrations.clients.list],
  ] as const;

  for (const [name, handler, ref] of lists) {
    it(`reads the first page of the ${name} list`, async () => {
      mocks.preloadConfectQuery.mockReturnValue(
        Effect.succeed(page([{ id: `${name}-1` }]))
      );

      const first = await handler({ data: { numItems: 25, slug: SLUG } });

      expect(first).toStrictEqual({
        isDone: false,
        page: [{ id: `${name}-1` }],
      });
      expect(mocks.preloadConfectQuery).toHaveBeenCalledExactlyOnceWith(
        ref,
        { paginationOpts: { cursor: null, numItems: 25 }, slug: SLUG },
        "token-settings"
      );
    });

    it(`answers no page for a failed ${name} read`, async () => {
      mocks.preloadConfectQuery.mockReturnValue(
        Effect.fail(new ReadFailed({ cause: "offline" }))
      );

      await expect(
        handler({ data: { numItems: 25, slug: SLUG } })
      ).resolves.toBeUndefined();
    });
  }
});

describe("units first screen", () => {
  it("reads the school's units", async () => {
    mocks.preloadConfectQuery.mockReturnValue(Effect.succeed([{ id: UNIT }]));

    const units = await unitsHandler({ data: { slug: SLUG } });

    expect(units).toStrictEqual([{ id: UNIT }]);
    expect(mocks.preloadConfectQuery).toHaveBeenCalledExactlyOnceWith(
      tenancy.units.list,
      { slug: SLUG },
      "token-settings"
    );
  });
});

describe("audit first screen", () => {
  it("restores each entry's subject name as an Option, with none for a missing name", async () => {
    mocks.preloadConfectQuery.mockImplementation((ref) =>
      Effect.succeed(
        ref === journal.audit.list
          ? page([
              { id: "entry-1", subjectName: Option.some("Sari") },
              { id: "entry-2", subjectName: Option.none() },
            ])
          : [{ kind: "operator" }]
      )
    );

    const screen = await auditHandler({ data: { numItems: 25, slug: SLUG } });

    expect(screen).toStrictEqual({
      entries: {
        isDone: false,
        page: [
          { id: "entry-1", subjectName: "Sari" },
          { id: "entry-2", subjectName: undefined },
        ],
      },
      people: [{ kind: "operator" }],
    });
  });

  it("answers no entries for a failed journal read", async () => {
    mocks.preloadConfectQuery.mockImplementation((ref) =>
      ref === journal.audit.list
        ? Effect.fail(new ReadFailed({ cause: "offline" }))
        : Effect.succeed([])
    );

    const screen = await auditHandler({ data: { numItems: 25, slug: SLUG } });

    expect(screen.entries).toBeUndefined();
    expect(screen.people).toStrictEqual([]);
  });
});

describe("periods first screen", () => {
  it("reads the first page of the unit's periods and names the unit it belongs to", async () => {
    mocks.preloadConfectQuery.mockReturnValue(
      Effect.succeed(page([{ id: PERIOD }]))
    );

    const screen = await periodsHandler({
      data: { numItems: 25, slug: SLUG, unitId: UNIT },
    });

    expect(screen).toStrictEqual({
      page: { isDone: false, page: [{ id: PERIOD }] },
      unitId: UNIT,
    });
    expect(mocks.preloadConfectQuery).toHaveBeenCalledExactlyOnceWith(
      tenancy.periods.list,
      {
        paginationOpts: { cursor: null, numItems: 25 },
        slug: SLUG,
        unitId: UNIT,
      },
      "token-settings"
    );
  });

  it("names the unit with no page for a failed periods read", async () => {
    mocks.preloadConfectQuery.mockReturnValue(
      Effect.fail(new ReadFailed({ cause: "offline" }))
    );

    const screen = await periodsHandler({
      data: { numItems: 25, slug: SLUG, unitId: UNIT },
    });

    expect(screen).toStrictEqual({ page: undefined, unitId: UNIT });
  });
});

describe("cohorts first screen", () => {
  it("reads the active period's cohorts when the unit has one", async () => {
    mocks.preloadConfectQuery.mockImplementation((ref) =>
      Effect.succeed(
        ref === tenancy.cohorts.activePeriod ? PERIOD : [{ id: COHORT }]
      )
    );

    const screen = await cohortsHandler({ data: { slug: SLUG, unitId: UNIT } });

    expect(screen).toStrictEqual({
      active: PERIOD,
      cohorts: [{ id: COHORT }],
      unitId: UNIT,
    });
    expect(mocks.preloadConfectQuery).toHaveBeenLastCalledWith(
      tenancy.cohorts.list,
      { periodId: PERIOD, slug: SLUG },
      "token-settings"
    );
  });

  it("reads no cohorts for a unit with no active period", async () => {
    mocks.preloadConfectQuery.mockReturnValue(Effect.succeed(null));

    const screen = await cohortsHandler({ data: { slug: SLUG, unitId: UNIT } });

    expect(screen).toStrictEqual({
      active: null,
      cohorts: undefined,
      unitId: UNIT,
    });
    expect(mocks.preloadConfectQuery).toHaveBeenCalledTimes(1);
  });

  it("reads no cohorts when the active period read fails", async () => {
    mocks.preloadConfectQuery.mockReturnValue(
      Effect.fail(new ReadFailed({ cause: "offline" }))
    );

    const screen = await cohortsHandler({ data: { slug: SLUG, unitId: UNIT } });

    expect(screen).toStrictEqual({
      active: undefined,
      cohorts: undefined,
      unitId: UNIT,
    });
  });
});

describe("cohort first screen", () => {
  it("reads the cohort, its first page of members, and its period's cohorts", async () => {
    mocks.preloadConfectQuery.mockImplementation((ref) => {
      if (ref === tenancy.cohorts.get) {
        return Effect.succeed({ id: COHORT, periodId: PERIOD });
      }
      if (ref === tenancy.cohorts.members) {
        return Effect.succeed(page([{ id: "member-1" }]));
      }
      return Effect.succeed([{ id: COHORT }]);
    });

    const screen = await cohortHandler({
      data: { cohortId: COHORT, numItems: 25, slug: SLUG },
    });

    expect(screen).toStrictEqual({
      cohorts: [{ id: COHORT }],
      detail: { id: COHORT, periodId: PERIOD },
      members: { isDone: false, page: [{ id: "member-1" }] },
    });
    expect(mocks.preloadConfectQuery).toHaveBeenCalledWith(
      tenancy.cohorts.list,
      { periodId: PERIOD, slug: SLUG },
      "token-settings"
    );
  });

  it("reads no period cohorts for a cohort that is not readable", async () => {
    mocks.preloadConfectQuery.mockReturnValue(
      Effect.fail(new ReadFailed({ cause: "denied" }))
    );

    const screen = await cohortHandler({
      data: { cohortId: COHORT, numItems: 25, slug: SLUG },
    });

    expect(screen).toStrictEqual({
      cohorts: undefined,
      detail: undefined,
      members: undefined,
    });
    expect(mocks.preloadConfectQuery).toHaveBeenCalledTimes(2);
  });
});
