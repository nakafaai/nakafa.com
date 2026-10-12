import { describe, expect, it } from "@effect/vitest";
import {
  exceedsDocumentLimit,
  NAME_TAIL,
  splitFileName,
} from "@/components/ai/attachments";

const MiB = 1024 * 1024;
/** One tenth of a MiB, rounded up to a whole byte. */
const TENTH_MIB = Math.ceil(MiB / 10);

function file(size: number, type: string) {
  return { size, type };
}

describe("message document limit", () => {
  it("accepts documents that total exactly 10 MiB", () => {
    expect(
      exceedsDocumentLimit([
        file(8 * MiB, "application/pdf"),
        file(2 * MiB, "text/plain"),
      ])
    ).toBe(false);
  });

  it("rejects documents that total 10.1 MiB", () => {
    expect(
      exceedsDocumentLimit([
        file(8 * MiB, "application/pdf"),
        file(2 * MiB + TENTH_MIB, "text/plain"),
      ])
    ).toBe(true);
  });

  it("ignores images of any size", () => {
    expect(
      exceedsDocumentLimit([
        file(12 * MiB, "image/png"),
        file(1 * MiB, "application/pdf"),
      ])
    ).toBe(false);
  });
});

describe("file name split", () => {
  it("keeps a short name whole at its end", () => {
    expect(splitFileName("notes.pdf")).toEqual({
      head: "",
      tail: "notes.pdf",
    });
  });

  it("gives away the start of a long name and keeps its end together", () => {
    const name = "Q3 Board Deck - FINAL (revised) v12 [approved by legal].pdf";

    const { head, tail } = splitFileName(name);

    expect(`${head}${tail}`).toBe(name);
    expect(tail).toBe(name.slice(-NAME_TAIL));
    expect(tail.endsWith(".pdf")).toBe(true);
  });

  it("never cuts inside a character the reader sees as one", () => {
    const technologist = "👩🏽‍💻";
    const head = "a".repeat(10);
    const rest = "b".repeat(NAME_TAIL - 1);

    expect(splitFileName(`${head}${technologist}${rest}`)).toEqual({
      head,
      tail: `${technologist}${rest}`,
    });
  });
});
