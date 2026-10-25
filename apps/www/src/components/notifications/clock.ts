import { createContext } from "react";
import type { StoreApi } from "zustand";
import type { AgeClock } from "@/components/user/clock";

/**
 * The clock of the inbox's ages, which the feed provides and every row reads, so
 * one timer moves every age of the inbox.
 */
export const NotificationsClockContext =
  createContext<StoreApi<AgeClock> | null>(null);
