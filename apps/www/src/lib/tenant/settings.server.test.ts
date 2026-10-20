// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import access from "@repo/backend/confect/_generated/refs/access";
import identity from "@repo/backend/confect/_generated/refs/identity";
import integrations from "@repo/backend/confect/_generated/refs/integrations";
import journal from "@repo/backend/confect/_generated/refs/journal";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { isNotFound } from "@tanstack/react-router";
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

/** A read that Convex could not answer: a real failure, which the screen fails with. */
class PreloadFailed extends Schema.TaggedError<PreloadFailed>()(
  "PreloadFailed",
  { cause: Schema.Unknown }
) {}

/** A refusal that the query declares for a viewer without the grant. */
const refused = () =>
  new AccessDenied({ action: "tenant.manage", reason: "role" });

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

    it(`ends the ${name} screen as not found when the viewer is refused it`, async () => {
      mocks.preloadConfectQuery.mockReturnValue(Effect.fail(refused()));

      await expect(
        handler({ data: { numItems: 25, slug: SLUG } })
      ).rejects.toSatisfy(isNotFound);
    });

    it(`fails the ${name} screen when its read fails`, async () => {
      mocks.preloadConfectQuery.mockReturnValue(
        Effect.fail(new PreloadFailed({ cause: "offline" }))
      );

      await expect(
        handler({ data: { numItems: 25, slug: SLUG } })
      ).rejects.toMatchObject({ _tag: "PreloadFailed" });
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

  it("ends the audit screen as not found when the journal is refused", async () => {
    mocks.preloadConfectQuery.mockImplementation((ref) =>
      ref === journal.audit.list ? Effect.fail(refused()) : Effect.succeed([])
    );

    await expect(
      auditHandler({ data: { numItems: 25, slug: SLUG } })
    ).rejects.toSatisfy(isNotFound);
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

  it("ends the periods screen as not found when the unit's periods are refused", async () => {
    mocks.preloadConfectQuery.mockReturnValue(Effect.fail(refused()));

    await expect(
      periodsHandler({ data: { numItems: 25, slug: SLUG, unitId: UNIT } })
    ).rejects.toSatisfy(isNotFound);
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

  it("ends the cohorts screen as not found when the active period is refused", async () => {
    mocks.preloadConfectQuery.mockReturnValue(Effect.fail(refused()));

    await expect(
      cohortsHandler({ data: { slug: SLUG, unitId: UNIT } })
    ).rejects.toSatisfy(isNotFound);
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

  it("ends the cohort screen as not found when the cohort is refused", async () => {
    mocks.preloadConfectQuery.mockReturnValue(Effect.fail(refused()));

    await expect(
      cohortHandler({
        data: { cohortId: COHORT, numItems: 25, slug: SLUG },
      })
    ).rejects.toSatisfy(isNotFound);
  });

  it("leaves the period's cohorts unread when the list is refused, and keeps the cohort", async () => {
    mocks.preloadConfectQuery.mockImplementation((ref) => {
      if (ref === tenancy.cohorts.get) {
        return Effect.succeed({ id: COHORT, periodId: PERIOD });
      }
      if (ref === tenancy.cohorts.list) {
        return Effect.fail(refused());
      }
      return Effect.succeed(page([]));
    });

    const screen = await cohortHandler({
      data: { cohortId: COHORT, numItems: 25, slug: SLUG },
    });

    expect(screen).toStrictEqual({
      cohorts: undefined,
      detail: { id: COHORT, periodId: PERIOD },
      members: { isDone: false, page: [] },
    });
  });
});
