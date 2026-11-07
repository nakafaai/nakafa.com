import type { SchoolPeriod } from "@repo/backend/confect/billing/tiers";
import { createContext, use } from "react";
import { createStore, type StoreApi, useStore } from "zustand";

/** The billing period the visitor reads the School prices for, and the action that changes it. */
type SchoolPeriodState = Record<"period", SchoolPeriod> &
  Record<"setPeriod", (period: SchoolPeriod) => void>;

/** Creates the period of one pricing page, monthly at first, as the static page draws it. */
export const createSchoolPeriod = () =>
  createStore<SchoolPeriodState>()((set) => ({
    period: 1,
    setPeriod: (period) => set({ period }),
  }));

/** The period store of one pricing page; the page's provider creates it once. */
export const SchoolPeriodContext =
  createContext<StoreApi<SchoolPeriodState> | null>(null);

/** Reads one part of the pricing page's period. It throws outside the page, which always provides it. */
export function useSchoolPeriod<Selected>(
  selector: (state: SchoolPeriodState) => Selected
) {
  const store = use(SchoolPeriodContext);
  if (store === null) {
    throw new Error("useSchoolPeriod must be used within SchoolPeriodProvider");
  }
  return useStore(store, selector);
}
