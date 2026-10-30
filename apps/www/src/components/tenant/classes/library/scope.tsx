import { createContext, type ReactNode, use, useState } from "react";
import type { StoreApi } from "zustand";
import {
  createLibraryUploads,
  type LibraryUploads,
} from "@/components/tenant/classes/library/uploads";

/** The files a class page is adding, which the header's dialog and the library share. */
const UploadsContext = createContext<StoreApi<LibraryUploads> | null>(null);

/** Holds the uploads of one class page, created once with the page. */
export function LibraryUploadsScope({ children }: { children: ReactNode }) {
  const [uploads] = useState(createLibraryUploads);
  return <UploadsContext value={uploads}>{children}</UploadsContext>;
}

/** Reads the uploads of the class page around the caller. */
export function useLibraryUploads() {
  const uploads = use(UploadsContext);
  if (uploads === null) {
    // A library outside its class page is a composition error at this seam.
    throw new Error("useLibraryUploads must be used within a class page");
  }
  return uploads;
}
