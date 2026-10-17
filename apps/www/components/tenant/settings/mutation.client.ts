"use client";

import type { Ref } from "@confect/core";
import { type OptimisticLocalStore, useMutation } from "@confect/react";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { applyPolicy } from "@repo/backend/confect/tenancy/policy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Option, Struct } from "effect";

/** The school as the settings pages read it: the viewer query of the tenant. */
type Viewer = Ref.Returns<typeof tenancy.viewer.get>;

/** The unit status a school settings mutation shows at once. */
type UnitStatus = Viewer["units"][number]["status"];

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

/** Shows one unit with a new status in the store, and leaves every other unit as it is. */
function withUnitStatus(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  slug: TenantSlug,
  unitId: Viewer["units"][number]["id"],
  status: UnitStatus
) {
  patchViewer(localStore, slug, (viewer) => ({
    ...viewer,
    units: Arr.map(viewer.units, (unit) =>
      unit.id === unitId ? { ...unit, status } : unit
    ),
  }));
}

/** Return a policy mutation that shows the chosen policy in the school at once. */
export function useSetPolicyMutation() {
  return useMutation(tenancy.settings.setPolicy).withOptimisticUpdate(
    (localStore, { policy, slug }) => {
      patchViewer(localStore, slug, (viewer) => ({
        ...viewer,
        tenant: {
          ...viewer.tenant,
          policies: applyPolicy(viewer.tenant.policies, policy),
        },
      }));
    }
  );
}

/** Return a logo mutation that takes the school's logo off at once, so the animal shows. */
export function useRemoveLogoMutation() {
  return useMutation(tenancy.logo.remove).withOptimisticUpdate(
    (localStore, { slug }) => {
      patchViewer(localStore, slug, (viewer) => ({
        ...viewer,
        tenant: Struct.omit(viewer.tenant, ["logo"]),
      }));
    }
  );
}

/** Return a unit mutation that shows the new time zone and content language at once. */
export function useSetUnitLocaleMutation() {
  return useMutation(tenancy.units.setLocale).withOptimisticUpdate(
    (localStore, { contentLanguage, slug, timeZone, unitId }) => {
      patchViewer(localStore, slug, (viewer) => ({
        ...viewer,
        units: Arr.map(viewer.units, (unit) =>
          unit.id === unitId ? { ...unit, contentLanguage, timeZone } : unit
        ),
      }));
    }
  );
}

/** Return a unit mutation that shows the unit as archived at once. */
export function useArchiveUnitMutation() {
  return useMutation(tenancy.units.archive).withOptimisticUpdate(
    (localStore, { slug, unitId }) => {
      withUnitStatus(localStore, slug, unitId, "archived");
    }
  );
}

/** Return a unit mutation that shows the unit as active again at once. */
export function useUnarchiveUnitMutation() {
  return useMutation(tenancy.units.unarchive).withOptimisticUpdate(
    (localStore, { slug, unitId }) => {
      withUnitStatus(localStore, slug, unitId, "active");
    }
  );
}
