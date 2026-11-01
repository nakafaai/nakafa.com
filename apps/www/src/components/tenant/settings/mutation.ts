import type { Ref } from "@confect/core";
import type { OptimisticLocalStore, OptimisticUpdate } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import access from "@repo/backend/confect/_generated/refs/access";
import integrations from "@repo/backend/confect/_generated/refs/integrations";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { applyPolicy } from "@repo/backend/confect/tenancy/policy";
import { Npsn } from "@repo/backend/confect/tenancy/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, DateTime, Option, Schema, Struct } from "effect";
import {
  type Client,
  draftText,
  type Grant,
  type Invite,
  isFirstPage,
  mapUnit,
  revokeClient,
  type Unit,
  withoutItem,
} from "@/components/tenant/settings/state";

/**
 * The optimistic changes of the school settings. Each one shows a mutation's
 * result in every loaded query it touches, so each open list shows it at once.
 * A refused change is undone by Confect when the server answers.
 */

/** One webhook as the school's list holds it. */
type Webhook = Ref.Returns<typeof integrations.webhooks.list>["page"][number];

/** The school as the settings pages read it: the viewer query of the tenant. */
type Viewer = Ref.Returns<typeof tenancy.viewer.get>;

/** The fields of a unit that a unit change sets, in either list that holds the unit. */
type UnitChange = <Item extends Unit | Viewer["units"][number]>(
  unit: Item
) => Item;

/** Patch the viewer of one school in the store, when the store holds it. */
export function patchViewer(
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

/** Changes the page of every loaded list of invites of one school that the matches accept. */
export function changeInviteLists(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  slug: TenantSlug,
  matches: (args: Ref.Args<typeof tenancy.invites.list>) => boolean,
  change: (page: readonly Invite[]) => Invite[]
) {
  for (const query of localStore.getAllQueries(tenancy.invites.list)) {
    if (
      Option.isSome(query.value) &&
      query.args.slug === slug &&
      matches(query.args)
    ) {
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
export function changeClientLists(
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

/** Changes the page of every loaded list of the grants of one school that the matches accept. */
export function changeGrantPages(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  slug: TenantSlug,
  matches: (args: Ref.Args<typeof access.grants.list>) => boolean,
  change: (page: readonly Grant[]) => Grant[]
) {
  for (const query of localStore.getAllQueries(access.grants.list)) {
    if (
      Option.isSome(query.value) &&
      query.args.slug === slug &&
      matches(query.args)
    ) {
      localStore.setQuery(
        access.grants.list,
        query.args,
        Option.some({
          ...query.value.value,
          page: change(query.value.value.page),
        })
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

/** Shows the school's new name at once, in the viewer that the sidebar and every settings page read. */
export const setNameChange: OptimisticUpdate<
  typeof tenancy.settings.setName
> = (localStore, { name, slug }) => {
  patchViewer(localStore, slug, (viewer) => ({
    ...viewer,
    tenant: { ...viewer.tenant, name },
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

/** Lists a new school at once, at the end of the school's units, as the server adds it last. */
export const addUnitChange: OptimisticUpdate<typeof tenancy.units.create> = (
  localStore,
  { contentLanguage, level, name, slug, timeZone }
) => {
  const draft: Unit = {
    contentLanguage,
    id: Schema.decodeUnknownSync(Id("tenantUnits"))(draftText()),
    level,
    name,
    npsn: null,
    status: "active",
    timeZone,
  };
  patchUnitList(localStore, slug, (units) => Arr.append(units, draft));
};

/** Shows the new time zone and page language of a unit at once. */
export const setUnitLocaleChange: OptimisticUpdate<
  typeof tenancy.units.setLocale
> = (localStore, { contentLanguage, slug, timeZone, unitId }) => {
  changeUnit(localStore, slug, unitId, (unit) => ({
    ...unit,
    contentLanguage,
    timeZone,
  }));
};

/** Shows the new name and level of a unit at once, in the viewer and the unit list. */
export const editUnitChange: OptimisticUpdate<typeof tenancy.units.edit> = (
  localStore,
  { level, name, slug, unitId }
) => {
  changeUnit(localStore, slug, unitId, (unit) => ({ ...unit, level, name }));
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

/** Takes an invite off the pending list at once. */
export const revokeInviteChange: OptimisticUpdate<
  typeof tenancy.invites.revoke
> = (localStore, { inviteId, slug }) => {
  changeInviteLists(
    localStore,
    slug,
    () => true,
    (page) => withoutItem(page, inviteId)
  );
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

/** Takes the setup out of the sidebar at once. */
export const finishSetupChange: OptimisticUpdate<
  typeof tenancy.setup.finish
> = (localStore, { slug }) => {
  patchViewer(localStore, slug, (viewer) => ({
    ...viewer,
    tenant: { ...viewer.tenant, setupDone: true },
  }));
};

/** Changes the page of every loaded list of webhooks of one school. */
function changeWebhookLists(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  slug: TenantSlug,
  change: (page: readonly Webhook[]) => Webhook[]
) {
  for (const query of localStore.getAllQueries(integrations.webhooks.list)) {
    if (Option.isSome(query.value) && query.args.slug === slug) {
      localStore.setQuery(
        integrations.webhooks.list,
        query.args,
        Option.some({
          ...query.value.value,
          page: change(query.value.value.page),
        })
      );
    }
  }
}

/** Shows a webhook's new receiver and changes at once. */
export const changeWebhookChange: OptimisticUpdate<
  typeof integrations.webhooks.change
> = (localStore, { changes, slug, url, webhookId }) => {
  changeWebhookLists(localStore, slug, (page) =>
    Arr.map(page, (webhook) =>
      webhook.id === webhookId
        ? Struct.assign(webhook, { changes, url })
        : webhook
    )
  );
};

/** Shows a webhook revoked at once. */
export const revokeWebhookChange: OptimisticUpdate<
  typeof integrations.webhooks.revoke
> = (localStore, { slug, webhookId }) => {
  changeWebhookLists(localStore, slug, (page) =>
    Arr.map(page, (webhook) =>
      webhook.id === webhookId
        ? Struct.assign(webhook, { status: "revoked" as const })
        : webhook
    )
  );
};

/** Lists one more attempt of a change at the top of its webhook's log, waiting. */
export const resendDeliveryChange: OptimisticUpdate<
  typeof integrations.webhooks.resend
> = (localStore, { deliveryId, webhookId }) => {
  for (const query of localStore.getAllQueries(
    integrations.webhooks.deliveries
  )) {
    if (
      Option.isSome(query.value) &&
      query.args.webhookId === webhookId &&
      isFirstPage(query.args)
    ) {
      const { page } = query.value.value;
      const resent = Arr.findFirst(page, (item) => item.id === deliveryId);
      if (Option.isSome(resent)) {
        const due: (typeof page)[number] = Struct.assign(resent.value, {
          attempt: resent.value.attempt + 1,
          id: Schema.decodeUnknownSync(Id("integrationDeliveries"))(
            draftText()
          ),
          state: { status: "due" as const },
        });
        localStore.setQuery(
          integrations.webhooks.deliveries,
          query.args,
          Option.some({ ...query.value.value, page: [due, ...page] })
        );
      }
    }
  }
};
