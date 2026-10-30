import { ClientKey } from "@repo/backend/confect/classroom/forum/message";
import { Array as Arr, Result, Schema } from "effect";
import { createStore } from "zustand";
import type { LibraryItem } from "@/components/tenant/classes/library/optimistic";

/**
 * One file the teacher is adding, shown first in the library from the moment the dialog closes.
 * `sent` is set once the server kept the file, so the row stays until the library's own row
 * for its client key arrives, and nothing flickers between the two.
 */
const Upload = Schema.Struct({
  author: Schema.String,
  clientKey: ClientKey,
  createdAt: Schema.Finite,
  kind: Schema.Literals(["pdf", "image"]),
  sent: Schema.Boolean,
  title: Schema.String,
});

/** One file the teacher is adding. */
export type LibraryUpload = typeof Upload.Type;

const UploadsState = Schema.Struct({ uploads: Schema.Array(Upload) });

/** The actions that start, keep, and end the adding of one file. */
interface UploadsActions {
  /** Ends an upload that the server refused, or whose item was removed. */
  readonly end: (clientKey: string) => void;
  /** Marks an upload as kept by the server. */
  readonly settle: (clientKey: string) => void;
  /** Starts an upload, so its row shows at once. */
  readonly start: (upload: LibraryUpload) => void;
}

/** The state of the files being added on one class page, with its actions. */
export type LibraryUploads = typeof UploadsState.Type & UploadsActions;

/** Creates the uploads of one class page. Each page creates its own, once. */
export const createLibraryUploads = () =>
  createStore<LibraryUploads>()((set) => ({
    end: (clientKey) =>
      set((state) => ({
        uploads: Arr.filter(
          state.uploads,
          (upload) => upload.clientKey !== clientKey
        ),
      })),
    settle: (clientKey) =>
      set((state) => ({
        uploads: Arr.map(state.uploads, (upload) =>
          upload.clientKey === clientKey ? { ...upload, sent: true } : upload
        ),
      })),
    start: (upload) =>
      set((state) => ({ uploads: Arr.prepend(state.uploads, upload) })),
    uploads: [],
  }));

/** Whether the library's loaded rows hold the item of an upload. */
const hasArrived = (upload: LibraryUpload, items: readonly LibraryItem[]) =>
  Arr.some(items, (item) => item.clientKey === upload.clientKey);

/**
 * The sent uploads whose item the library shows for the first time, which the list remembers as
 * seen, so an item that later leaves the library does not bring its upload back.
 */
export const arrivedUploads = (
  uploads: readonly LibraryUpload[],
  items: readonly LibraryItem[],
  seen: readonly string[]
) =>
  Arr.filterMap(uploads, (upload) =>
    upload.sent &&
    hasArrived(upload, items) &&
    !Arr.contains(seen, upload.clientKey)
      ? Result.succeed(upload.clientKey)
      : Result.failVoid
  );

/**
 * The uploads the library shows above its own rows: each one whose item has not arrived yet,
 * and was never seen in the library.
 */
export const pendingUploads = (
  uploads: readonly LibraryUpload[],
  items: readonly LibraryItem[],
  seen: readonly string[]
) =>
  Arr.filter(
    uploads,
    (upload) =>
      !(hasArrived(upload, items) || Arr.contains(seen, upload.clientKey))
  );
