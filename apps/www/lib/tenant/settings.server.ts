import "@tanstack/react-start/server-only";
import { Id } from "@repo/backend/confect/_generated/id";
import access from "@repo/backend/confect/_generated/refs/access";
import identity from "@repo/backend/confect/_generated/refs/identity";
import integrations from "@repo/backend/confect/_generated/refs/integrations";
import journal from "@repo/backend/confect/_generated/refs/journal";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Effect, Option, Schema } from "effect";
import type { PreloadedPage } from "@/lib/data/paginated";
import { readOptional, readRequired } from "@/lib/data/read.server";
import { memberHandler } from "@/lib/tenant/member.server";

/** The rows a settings list asks for on its first page: at least one, and at most one hundred. */
const PageSize = Schema.Int.check(
  Schema.isBetween({ maximum: 100, minimum: 1 })
);

/** The school whose settings a page reads. */
export const SchoolInput = Schema.Struct({ slug: TenantSlug });

/** The school whose settings a page reads, with the first page size of its list. */
export const SettingsListInput = Schema.Struct({
  numItems: PageSize,
  slug: TenantSlug,
});

/** The school and one of its units, whose periods or cohorts a page reads. */
export const UnitScopeInput = Schema.Struct({
  numItems: PageSize,
  slug: TenantSlug,
  unitId: Id("tenantUnits"),
});

/** The school and one of its units, whose active period and cohorts a page reads. */
export const UnitInput = Schema.Struct({
  slug: TenantSlug,
  unitId: Id("tenantUnits"),
});

/** The school and one of its cohorts. */
export const CohortInput = Schema.Struct({
  cohortId: Id("tenantCohorts"),
  numItems: PageSize,
  slug: TenantSlug,
});

/** The first page of a paginated settings list, as the page takes it: its rows and whether it is the last. */
function firstPage<Item>(page: {
  readonly isDone: boolean;
  readonly page: readonly Item[];
}): PreloadedPage<Item> {
  return { isDone: page.isDone, page: page.page };
}

/** The units of the school, with their status, for the units tab and the unit choice of the other tabs. */
export const unitsHandler = memberHandler(
  ({ slug }: typeof SchoolInput.Type, token: string) =>
    readRequired(tenancy.units.list, { slug }, token)
);

/** The first page of the school's student logins. */
export const studentsHandler = memberHandler(
  ({ numItems, slug }: typeof SettingsListInput.Type, token: string) =>
    readRequired(
      identity.logins.list,
      { paginationOpts: { cursor: null, numItems }, slug },
      token
    ).pipe(Effect.map(firstPage))
);

/** The first page of the school's role grants. */
export const rolesHandler = memberHandler(
  ({ numItems, slug }: typeof SettingsListInput.Type, token: string) =>
    readRequired(
      access.grants.list,
      { paginationOpts: { cursor: null, numItems }, slug },
      token
    ).pipe(Effect.map(firstPage))
);

/** The first page of the school's members. */
export const membersHandler = memberHandler(
  ({ numItems, slug }: typeof SettingsListInput.Type, token: string) =>
    readRequired(
      tenancy.roster.members,
      { paginationOpts: { cursor: null, numItems }, slug },
      token
    ).pipe(Effect.map(firstPage))
);

/** The first page of the school's invites. */
export const invitesHandler = memberHandler(
  ({ numItems, slug }: typeof SettingsListInput.Type, token: string) =>
    readRequired(
      tenancy.invites.list,
      { paginationOpts: { cursor: null, numItems }, slug },
      token
    ).pipe(Effect.map(firstPage))
);

/** The first page of the school's integration clients. */
export const clientsHandler = memberHandler(
  ({ numItems, slug }: typeof SettingsListInput.Type, token: string) =>
    readRequired(
      integrations.clients.list,
      { paginationOpts: { cursor: null, numItems }, slug },
      token
    ).pipe(Effect.map(firstPage))
);

/** The first page of the audit journal, with the people who appear in it. */
export const auditHandler = memberHandler(
  ({ numItems, slug }: typeof SettingsListInput.Type, token: string) =>
    Effect.gen(function* () {
      const [entries, people] = yield* Effect.all(
        [
          readRequired(
            journal.audit.list,
            { paginationOpts: { cursor: null, numItems }, slug },
            token
          ),
          readRequired(journal.audit.actors, { slug }, token),
        ],
        { concurrency: "unbounded" }
      );
      return {
        entries: firstPage({
          isDone: entries.isDone,
          page: Arr.map(entries.page, (entry) => ({
            ...entry,
            subjectName: Option.getOrUndefined(entry.subjectName),
          })),
        }),
        people,
      };
    })
);

/** The first page of one unit's periods, with the unit it belongs to. */
export const periodsHandler = memberHandler(
  ({ numItems, slug, unitId }: typeof UnitScopeInput.Type, token: string) =>
    Effect.gen(function* () {
      const page = yield* readRequired(
        tenancy.periods.list,
        { paginationOpts: { cursor: null, numItems }, slug, unitId },
        token
      );
      return { page: firstPage(page), unitId };
    })
);

/**
 * One unit's active period and the cohorts of that period, which the cohorts tab
 * shows first. A unit with no active period has no cohorts to list.
 */
export const cohortsHandler = memberHandler(
  ({ slug, unitId }: typeof UnitInput.Type, token: string) =>
    Effect.gen(function* () {
      const active = yield* readRequired(
        tenancy.cohorts.activePeriod,
        { slug, unitId },
        token
      );
      if (active === null) {
        return { active, cohorts: undefined, unitId };
      }
      const cohorts = yield* readRequired(
        tenancy.cohorts.list,
        { periodId: active, slug },
        token
      );
      return { active, cohorts, unitId };
    })
);

/** One cohort, its first page of members, and the cohorts of its period. */
export const cohortHandler = memberHandler(
  ({ cohortId, numItems, slug }: typeof CohortInput.Type, token: string) =>
    Effect.gen(function* () {
      const [detail, members] = yield* Effect.all(
        [
          readRequired(tenancy.cohorts.get, { cohortId, slug }, token),
          readRequired(
            tenancy.cohorts.members,
            { cohortId, paginationOpts: { cursor: null, numItems }, slug },
            token
          ),
        ],
        { concurrency: "unbounded" }
      );
      const cohorts = yield* readOptional(
        tenancy.cohorts.list,
        { periodId: detail.periodId, slug },
        token
      );
      return { cohorts, detail, members: firstPage(members) };
    })
);
