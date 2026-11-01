import { describe, expect, it } from "@effect/vitest";
import { LIBRARY_BYTE_LIMIT } from "@repo/backend/confect/classroom/library/file";
import { Array as Arr, Option } from "effect";
import {
  EMPTY_DRAFT,
  isDraftReady,
  isOversize,
  stepDraft,
} from "@/components/tenant/classes/library/draft";

const picked = { id: "file-1", mimeType: "application/pdf", name: "Modul.pdf" };
const file = new File(["bytes"], "Bab 3.final.pdf", {
  type: "application/pdf",
});

/** The draft after a list of changes from the empty one. */
const after = (changes: readonly Parameters<typeof stepDraft>[1][]) =>
  Arr.reduce(changes, EMPTY_DRAFT, stepDraft);

describe("stepDraft", () => {
  it("keeps each tab's source while the teacher moves between the tabs", () => {
    const draft = after([
      { _tag: "file", file },
      { _tag: "mode", mode: "link" },
      { _tag: "address", text: "https://nakafa.com" },
      { _tag: "mode", mode: "file" },
    ]);

    expect(draft.file).toBe(file);
    expect(draft.address).toBe("https://nakafa.com");
    expect(draft.mode).toBe("file");
  });

  it("names the item after a chosen file only while no title is written", () => {
    expect(after([{ _tag: "file", file }]).title).toBe("Bab 3.final");
    expect(
      after([
        { _tag: "title", text: "Modul" },
        { _tag: "file", file },
      ]).title
    ).toBe("Modul");
    expect(after([{ _tag: "file", file: null }]).title).toBe("");
  });

  it("clears a chosen device file without touching the title", () => {
    const draft = after([
      { _tag: "file", file },
      { _tag: "file", file: null },
    ]);

    expect(draft.file).toBeNull();
    expect(draft.title).toBe("Bab 3.final");
  });

  it("holds the Picker from the press and ends on its answer, keeping the chosen file on a cancel", () => {
    const chosen = after([
      { _tag: "picking" },
      { _tag: "picked", picked: Option.some(picked) },
    ]);

    expect(after([{ _tag: "picking" }]).driveStep).toBe("picking");
    expect(chosen.driveStep).toBe("idle");
    expect(chosen.drive).toEqual(Option.some(picked));
    expect(chosen.title).toBe("Modul");

    const cancelled = stepDraft(stepDraft(chosen, { _tag: "picking" }), {
      _tag: "picked",
      picked: Option.none(),
    });
    expect(cancelled.driveStep).toBe("idle");
    expect(cancelled.drive).toEqual(Option.some(picked));
  });

  it("clears the picked file", () => {
    expect(
      after([
        { _tag: "picked", picked: Option.some(picked) },
        { _tag: "cleared" },
      ]).drive
    ).toEqual(Option.none());
  });

  it("drops the missing sentence when the teacher leaves the tab, and keeps a Picker that still runs", () => {
    const missing = after([{ _tag: "picking" }, { _tag: "missing" }]);
    expect(missing.driveStep).toBe("missing");
    expect(stepDraft(missing, { _tag: "mode", mode: "file" }).driveStep).toBe(
      "idle"
    );

    expect(
      after([{ _tag: "picking" }, { _tag: "mode", mode: "file" }]).driveStep
    ).toBe("picking");
  });

  it("restores a link that failed, on its tab, over what the reset emptied", () => {
    const draft = after([
      { _tag: "restored", address: "https://nakafa.com", title: "Modul" },
    ]);

    expect(draft.mode).toBe("link");
    expect(draft.address).toBe("https://nakafa.com");
    expect(draft.title).toBe("Modul");
  });

  it("keeps what the teacher wrote since a link was sent over the link that failed", () => {
    const draft = after([
      { _tag: "title", text: "Newer" },
      { _tag: "address", text: "https://example.com" },
      { _tag: "restored", address: "https://nakafa.com", title: "Modul" },
    ]);

    expect(draft.title).toBe("Newer");
    expect(draft.address).toBe("https://example.com");
  });

  it("empties on a reset", () => {
    expect(
      after([
        { _tag: "file", file },
        { _tag: "mode", mode: "link" },
        { _tag: "reset" },
      ])
    ).toEqual(EMPTY_DRAFT);
  });
});

describe("isOversize", () => {
  it("names a file larger than the library keeps, and no file at all is not one", () => {
    expect(isOversize(null)).toBe(false);
    expect(isOversize(file)).toBe(false);
    const large = new File(["x"], "large.pdf");
    Object.defineProperty(large, "size", { value: LIBRARY_BYTE_LIMIT + 1 });
    expect(isOversize(large)).toBe(true);
  });
});

describe("isDraftReady", () => {
  it("waits for a title and for the source of the tab the draft is on", () => {
    expect(isDraftReady(EMPTY_DRAFT)).toBe(false);
    expect(isDraftReady(after([{ _tag: "title", text: "Modul" }]))).toBe(false);
    expect(isDraftReady(after([{ _tag: "file", file }]))).toBe(true);
  });

  it("reads only the tab's own source", () => {
    const draft = after([
      { _tag: "file", file },
      { _tag: "mode", mode: "link" },
      { _tag: "address", text: "not an address" },
    ]);
    expect(isDraftReady(draft)).toBe(false);
    expect(
      isDraftReady(
        stepDraft(draft, { _tag: "address", text: "https://nakafa.com" })
      )
    ).toBe(true);
    expect(
      isDraftReady(
        after([
          { _tag: "mode", mode: "drive" },
          { _tag: "picked", picked: Option.some(picked) },
        ])
      )
    ).toBe(true);
  });

  it("refuses a file larger than the library keeps", () => {
    const large = new File(["x"], "large.pdf");
    Object.defineProperty(large, "size", { value: LIBRARY_BYTE_LIMIT + 1 });

    expect(isDraftReady(after([{ _tag: "file", file: large }]))).toBe(false);
  });
});
