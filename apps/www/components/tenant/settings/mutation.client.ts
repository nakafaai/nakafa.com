"use client";

import type { Ref } from "@confect/core";
import type { OptimisticLocalStore, OptimisticUpdate } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import access from "@repo/backend/confect/_generated/refs/access";
import integrations from "@repo/backend/confect/_generated/refs/integrations";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { applyPolicy } from "@repo/backend/confect/tenancy/policy";
import { Npsn } from "@repo/backend/confect/tenancy/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { randomUuid } from "@repo/utilities/uuid";
import { DateTime, Effect, Option, Schema, Struct } from "effect";
import {
  addGrant,
  type Client,
  type Grant,
  type Invite,
  insertPeriod,
  mapUnit,
  type Period,
  revokeClient,
  setPeriodStatus,
  type Unit,
  withoutItem,
} from "@/components/tenant/settings/state";

/**
 * The optimistic changes of the school settings. Each one shows a mutation's
 * result in every loaded query it touches, so each open list shows it at once.
 * A refused change is undone by Confect when the server answers.
 */

/** The school as the settings pages read it: the viewer query of the tenant. */
type Viewer = Ref.Returns<typeof tenancy.viewer.get>;

/** The fields of a unit that a unit change sets, in either list that holds the unit. */
type UnitChange = <Item extends Unit | Viewer["units"][number]>(
  unit: Item
) => Item;

/** Patch the viewer of one school in the store, when the store holds it. */
function patchViewer(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  slug: TenantSlug,
  patch: (viewer: Viewer) => Viewer
) {
  const current = Option.getOrUndefined(
    localStore.getQuery(tenancy.viewer.get, { slug })
  );
  if (current) {
    localStore.setQuery(
      tenancy.viewer.get,
      { slug },
      Option.some(patch(current))
    );
  }
}

/** Patch the unit list of one school in the store, when the store holds it. */
function patchUnitList(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  slug: TenantSlug,
  patch: (units: readonly Unit[]) => Unit[]
) {
  const current = Option.getOrUndefined(
    localStore.getQuery(tenancy.units.list, { slug })
  );
  if (current) {
    localStore.setQuery(
      tenancy.units.list,
      { slug },
      Option.some(patch(current))
    );
  }
}

/** Shows one unit changed in both the viewer and the unit list, and every other unit as it is. */
function changeUnit(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  slug: TenantSlug,
  unitId: Unit["id"],
  change: UnitChange
) {
  patchViewer(localStore, slug, (viewer) => ({
    ...viewer,
    units: mapUnit(viewer.units, unitId, change),
  }));
  patchUnitList(localStore, slug, (units) => mapUnit(units, unitId, change));
}

/** Changes the page of every loaded list of periods that the match accepts. */
function changePeriodLists(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  matches: (args: Ref.Args<typeof tenancy.periods.list>) => boolean,
  change: (page: readonly Period[]) => Period[]
) {
  for (const query of localStore.getAllQueries(tenancy.periods.list)) {
    if (Option.isSome(query.value) && matches(query.args)) {
      localStore.setQuery(
        tenancy.periods.list,
        query.args,
        Option.some({
          ...query.value.value,
          page: change(query.value.value.page),
        })
      );
    }
  }
}

/** Changes the page of every loaded list of invites of one school. */
function changeInviteLists(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  slug: TenantSlug,
  change: (page: readonly Invite[]) => Invite[]
) {
  for (const query of localStore.getAllQueries(tenancy.invites.list)) {
    if (Option.isSome(query.value) && query.args.slug === slug) {
      localStore.setQuery(
        tenancy.invites.list,
        query.args,
        Option.some({
          ...query.value.value,
          page: change(query.value.value.page),
        })
      );
    }
  }
}

/** Changes the page of every loaded list of integration clients of one school. */
function changeClientLists(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  slug: TenantSlug,
  change: (page: readonly Client[]) => Client[]
) {
  for (const query of localStore.getAllQueries(integrations.clients.list)) {
    if (Option.isSome(query.value) && query.args.slug === slug) {
      localStore.setQuery(
        integrations.clients.list,
        query.args,
        Option.some({
          ...query.value.value,
          page: change(query.value.value.page),
        })
      );
    }
  }
}

/** Changes every loaded list of grants that the match accepts. */
function changeGrantLists(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  matches: (args: Ref.Args<typeof access.grants.list>) => boolean,
  change: (grants: readonly Grant[]) => Grant[]
) {
  for (const query of localStore.getAllQueries(access.grants.list)) {
    if (Option.isSome(query.value) && matches(query.args)) {
      localStore.setQuery(
        access.grants.list,
        query.args,
        Option.some(change(query.value.value))
      );
    }
  }
}

/** Shows the policy the school chose at once. */
export const setPolicyChange: OptimisticUpdate<
  typeof tenancy.settings.setPolicy
> = (localStore, { policy, slug }) => {
  patchViewer(localStore, slug, (viewer) => ({
    ...viewer,
    tenant: {
      ...viewer.tenant,
      policies: applyPolicy(viewer.tenant.policies, policy),
    },
  }));
};

/** Takes the school's logo off at once, so the animal shows. */
export const removeLogoChange: OptimisticUpdate<typeof tenancy.logo.remove> = (
  localStore,
  { slug }
) => {
  patchViewer(localStore, slug, (viewer) => ({
    ...viewer,
    tenant: Struct.omit(viewer.tenant, ["logo"]),
  }));
};

/** Shows the new time zone and content language of a unit at once. */
export const setUnitLocaleChange: OptimisticUpdate<
  typeof tenancy.units.setLocale
> = (localStore, { contentLanguage, slug, timeZone, unitId }) => {
  changeUnit(localStore, slug, unitId, (unit) => ({
    ...unit,
    contentLanguage,
    timeZone,
  }));
};

/** Shows a unit as archived at once. */
export const archiveUnitChange: OptimisticUpdate<
  typeof tenancy.units.archive
> = (localStore, { slug, unitId }) => {
  changeUnit(localStore, slug, unitId, (unit) => ({
    ...unit,
    status: "archived",
  }));
};

/** Shows a unit as active again at once. */
export const unarchiveUnitChange: OptimisticUpdate<
  typeof tenancy.units.unarchive
> = (localStore, { slug, unitId }) => {
  changeUnit(localStore, slug, unitId, (unit) => ({
    ...unit,
    status: "active",
  }));
};

/** Shows the national school number of a unit at once, when the number has eight digits. */
export const setNpsnChange: OptimisticUpdate<typeof tenancy.units.setNpsn> = (
  localStore,
  { npsn, slug, unitId }
) => {
  if (Schema.is(Npsn)(npsn)) {
    patchUnitList(localStore, slug, (units) =>
      mapUnit(units, unitId, (unit) => ({ ...unit, npsn }))
    );
  }
};

/** Lists a new period at once, in the order of its unit's list, as planned. */
export const createPeriodChange: OptimisticUpdate<
  typeof tenancy.periods.create
> = (localStore, { end, name, start, unitId }) => {
  const draft: Period = {
    end,
    id: Schema.decodeUnknownSync(Id("tenantPeriods"))(
      Effect.runSync(randomUuid)
    ),
    name,
    start,
    status: "planned",
  };
  changePeriodLists(
    localStore,
    (args) => args.unitId === unitId,
    (page) => insertPeriod(page, draft)
  );
};

/** Shows a period as open at once. */
export const openPeriodChange: OptimisticUpdate<typeof tenancy.periods.open> = (
  localStore,
  { periodId }
) => {
  changePeriodLists(
    localStore,
    () => true,
    (page) => setPeriodStatus(page, periodId, "active")
  );
};

/** Shows a period as archived at once. */
export const archivePeriodChange: OptimisticUpdate<
  typeof tenancy.periods.archive
> = (localStore, { periodId }) => {
  changePeriodLists(
    localStore,
    () => true,
    (page) => setPeriodStatus(page, periodId, "archived")
  );
};

/** Takes an invite off the pending list at once. */
export const revokeInviteChange: OptimisticUpdate<
  typeof tenancy.invites.revoke
> = (localStore, { inviteId, slug }) => {
  changeInviteLists(localStore, slug, (page) => withoutItem(page, inviteId));
};

/** Shows a client as revoked at once. */
export const revokeClientChange: OptimisticUpdate<
  typeof integrations.clients.revoke
> = (localStore, { clientId, slug }) => {
  const revokedAt = DateTime.toEpochMillis(DateTime.nowUnsafe());
  changeClientLists(localStore, slug, (page) =>
    revokeClient(page, clientId, revokedAt)
  );
};

/** Lists a new grant of a person at once, at the end of its grants. */
export const assignGrantChange: OptimisticUpdate<
  typeof access.grants.assign
> = (localStore, { personId, role, scope }) => {
  const draft: Grant = {
    id: Schema.decodeUnknownSync(Id("tenantGrants"))(
      Effect.runSync(randomUuid)
    ),
    role: { key: role, kind: "builtin" },
    scope,
    term: { kind: "standing" },
  };
  changeGrantLists(
    localStore,
    (args) => args.personId === personId,
    (grants) => addGrant(grants, draft)
  );
};

/** Takes a grant off every open list of grants at once. */
export const revokeGrantChange: OptimisticUpdate<
  typeof access.grants.revoke
> = (localStore, { grantId }) => {
  changeGrantLists(
    localStore,
    () => true,
    (grants) => withoutItem(grants, grantId)
  );
};
