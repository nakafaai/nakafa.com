import { describe, expect, it } from "@effect/vitest";
import { FOLDER_LIMIT } from "@repo/backend/confect/classroom/library/folder";
import {
  ancestry,
  hiddenFolders,
  subtree,
} from "@repo/backend/confect/classroom/library/tree";
import { Array as Arr, Order } from "effect";

/** A folder row as the tree reads it: its ID, the folder it sits in, and its time in the trash. */
const folder = (id: string, parentId?: string, trashedAt?: number) => ({
  _id: id,
  parentId,
  trashedAt,
});

describe("classroom/library tree", () => {
  it("walks up to the top, hides what a trashed folder holds, and finds a folder's whole subtree", () => {
    const folders = [
      folder("a"),
      folder("b", "a", 5),
      folder("c", "b"),
      folder("d", "a"),
    ];
    expect(Arr.map(ancestry(folders, "c"), (found) => found._id)).toEqual([
      "c",
      "b",
      "a",
    ]);
    expect(
      Arr.sort(Arr.fromIterable(hiddenFolders(folders)), Order.String)
    ).toEqual(["b", "c"]);
    expect(
      Arr.sort(Arr.fromIterable(subtree(folders, "b")), Order.String)
    ).toEqual(["b", "c"]);
  });

  it("stops at a folder whose parent is gone", () => {
    expect(ancestry([folder("x", "gone")], "x")).toEqual([folder("x", "gone")]);
  });

  it("stops a walk that meets a cycle", () => {
    const folders = [folder("a", "b"), folder("b", "a")];
    expect(ancestry(folders, "a")).toHaveLength(FOLDER_LIMIT);
  });
});
