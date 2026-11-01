import { createContext, use } from "react";
import type { DirectoryEntry } from "@/components/connectors/directory";

/** The service of one card or of the open detail, with its connection and where it stands. */
export const ServiceContext = createContext<typeof DirectoryEntry.Type | null>(
  null
);

/** Reads the service around the caller. */
export function useService() {
  const service = use(ServiceContext);

  if (service === null) {
    throw new Error("useService must be used within a service");
  }

  return service;
}
