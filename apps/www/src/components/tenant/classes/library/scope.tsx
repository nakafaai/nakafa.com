import type { Id } from "@repo/backend/confect/_generated/id";
import { createContext, type ReactNode, use, useState } from "react";
import type { StoreApi } from "zustand";
import {
  createLibraryUploads,
  type LibraryUploads,
} from "@/components/tenant/classes/library/uploads";

/** The files a class page is adding, which the header's dialog and the library share. */
const UploadsContext = createContext<StoreApi<LibraryUploads> | null>(null);

/** The folder the page shows, which is none at the top of the library. */
const FolderContext = createContext<Id<"classroomFolders"> | null>(null);

/** Holds the folder of one library page, and its uploads, created once with the page. */
export function LibraryScope({
  children,
  folderId,
}: {
  children: ReactNode;
  folderId: Id<"classroomFolders"> | null;
}) {
  const [uploads] = useState(createLibraryUploads);
  return (
    <FolderContext value={folderId}>
      <UploadsContext value={uploads}>{children}</UploadsContext>
    </FolderContext>
  );
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

/** Reads the folder the page around the caller shows, which is none at the top of the library. */
export function useLibraryFolder() {
  return use(FolderContext);
}
