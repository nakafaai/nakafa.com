import { describe, expect, it } from "@effect/vitest";
import { channelLabel } from "@/components/tenant/classes/label";

describe("channelLabel", () => {
  it("names the general channel in the viewer's language and a topic by its own name", () => {
    expect(channelLabel({ kind: "general", name: "general" }, "Umum")).toBe(
      "Umum"
    );
    expect(channelLabel({ kind: "topic", name: "Tugas" }, "Umum")).toBe(
      "Tugas"
    );
  });
});
