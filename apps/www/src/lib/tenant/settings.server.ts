import access from "@repo/backend/confect/_generated/refs/access";
import identity from "@repo/backend/confect/_generated/refs/identity";
import integrations from "@repo/backend/confect/_generated/refs/integrations";
import journal from "@repo/backend/confect/_generated/refs/journal";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Array as Arr, Effect, Option } from "effect";
import type { PreloadedPage } from "@/lib/data/paginated";
import { readOptional, readRequired } from "@/lib/data/read.server";
import { memberHandler } from "@/lib/tenant/member.server";
import type {
  CohortInput,
  SchoolInput,
  SettingsListInput,
  UnitInput,
  UnitScopeInput,
} from "@/lib/tenant/settings";

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
