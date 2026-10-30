import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import type { LibraryItem } from "@/components/tenant/classes/library/optimistic";
import {
  arrivedUploads,
  createLibraryUploads,
  type LibraryUpload,
  pendingUploads,
} from "@/components/tenant/classes/library/uploads";

/** A file the teacher is adding under a client key. */
const upload = (clientKey: string, sent: boolean): LibraryUpload => ({
  author: "Bu Rina",
  clientKey,
  createdAt: 1,
  kind: "pdf",
  sent,
  title: "Modul",
});

/** The library's own row of an upload. */
const item = (clientKey: string): LibraryItem => ({
  address: "https://files.test/modul.pdf",
  author: "Bu Rina",
  byteSize: 10,
  clientKey,
  createdAt: 1,
  id: Schema.decodeUnknownSync(Id("classroomLibrary"))(`item-${clientKey}`),
  kind: "pdf",
  title: "Modul",
});

const first = "0b5c9d1e-4f3a-4c2b-9a8d-7e6f5a4b3c2d";
const second = "1c6d0e2f-5a4b-4d3c-8b9e-8f7a6b5c4d3e";

describe("library uploads", () => {
  it("starts an upload first, keeps it once sent, and ends it", () => {
    const store = createLibraryUploads();
    store.getState().start(upload(first, false));
    store.getState().start(upload(second, false));
    store.getState().settle(first);
    expect(store.getState().uploads).toEqual([
      upload(second, false),
      upload(first, true),
    ]);
    store.getState().end(second);
    expect(store.getState().uploads).toEqual([upload(first, true)]);
  });

  it("shows an upload until its row arrives, remembers the arrival of a sent one, and never shows a seen one again", () => {
    const uploads = [upload(first, true), upload(second, false)];
    expect(pendingUploads(uploads, [], [])).toEqual(uploads);
    const arrived = [item(first), item(second)];
    expect(arrivedUploads(uploads, arrived, [])).toEqual([first]);
    expect(arrivedUploads(uploads, arrived, [first])).toEqual([]);
    expect(pendingUploads(uploads, arrived, [])).toEqual([]);
    expect(pendingUploads(uploads, [], [first])).toEqual([
      upload(second, false),
    ]);
  });
});
