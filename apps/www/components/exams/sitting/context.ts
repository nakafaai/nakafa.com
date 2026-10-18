import { Id } from "@repo/backend/confect/_generated/id";
import { DashboardView } from "@repo/backend/confect/exams/sittings/contract";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { createContext, use } from "react";
import { type StoreApi, useStore } from "zustand";
import type { SittingStore } from "@/components/exams/sitting/store";

/**
 * What the dashboard holds for one sitting: the page that the query answers, the school's
 * address, and whether the viewer may take the proctor's actions.
 */
const SittingData = Schema.Struct({
  canProctor: Schema.Boolean,
  sittingId: Id("examSittings"),
  slug: TenantSlug,
  value: DashboardView,
});
export type SittingData = typeof SittingData.Type;

/** The dashboard's data, which the page computes during render. */
export const SittingDataContext = createContext<SittingData | null>(null);

/** The dashboard's own state, which its actions write. */
export const SittingStoreContext = createContext<StoreApi<SittingStore> | null>(
  null
);

/** Reads the dashboard's data. It throws outside the dashboard, which always provides it. */
export function useSittingData() {
  const data = use(SittingDataContext);
  if (data === null) {
    throw new Error("useSittingData must be used within the sitting dashboard");
  }
  return data;
}

/** Reads one part of the dashboard's own state. It throws outside the dashboard. */
export function useSittingStore<Selected>(
  selector: (state: SittingStore) => Selected
) {
  const store = use(SittingStoreContext);
  if (store === null) {
    throw new Error(
      "useSittingStore must be used within the sitting dashboard"
    );
  }
  return useStore(store, selector);
}
