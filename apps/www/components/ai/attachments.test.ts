import { describe, expect, it } from "@effect/vitest";
import { exceedsDocumentLimit } from "@/components/ai/attachments";

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
