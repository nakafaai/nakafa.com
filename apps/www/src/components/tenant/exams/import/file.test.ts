import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { fileKindOf, titleOfFile } from "@/components/tenant/exams/import/file";

describe("fileKindOf", () => {
  it("reads a PDF and a ZIP from their leading bytes, whatever the file is called", () => {
    expect(fileKindOf(new TextEncoder().encode("%PDF-1.7\n"))).toEqual(
      Option.some("pdf")
    );
    expect(fileKindOf(Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14]))).toEqual(
      Option.some("zip")
    );
  });

  it("refuses any other file, and one shorter than a signature", () => {
    expect(fileKindOf(new TextEncoder().encode("MZ executable"))).toEqual(
      Option.none()
    );
    expect(fileKindOf(Uint8Array.from([0x25, 0x50]))).toEqual(Option.none());
  });
});

describe("titleOfFile", () => {
  it("takes the name without its extension as the exam's title", () => {
    expect(titleOfFile("  PTS Matematika 2026.docx")).toEqual(
      Option.some("PTS Matematika 2026")
    );
    expect(titleOfFile("Soal.final.pdf")).toEqual(Option.some("Soal.final"));
    expect(titleOfFile("README")).toEqual(Option.some("README"));
  });

  it("gives no title for a name that holds only its extension or spaces", () => {
    expect(titleOfFile(".pdf")).toEqual(Option.some(".pdf"));
    expect(titleOfFile("   .docx")).toEqual(Option.none());
    expect(titleOfFile("   ")).toEqual(Option.none());
  });
});
