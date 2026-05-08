import { importContentModule } from "@repo/contents/_lib/module";
import { describe, expect, it } from "vitest";

describe("importContentModule", () => {
  it("returns the dynamic import promise for localized content modules", async () => {
    await expect(importContentModule("missing/module", "en")).rejects.toThrow();
  });
});
