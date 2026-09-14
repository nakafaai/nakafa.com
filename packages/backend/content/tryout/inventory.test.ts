import { describe, expect, it } from "@effect/vitest";
import type {
  TryoutSection,
  TryoutSet,
} from "@nakafa/aksara-contracts/tryout/catalog";
import { provesSetInventory } from "@repo/backend/content/tryout/inventory";
import { makeTryoutStartCatalog } from "@repo/backend/test/tryout/source";

/** Selects the signed set and its sections from the start catalog fixture. */
function inventoryFixture() {
  const rows = makeTryoutStartCatalog("id", "visible");
  const set = rows.find((row): row is TryoutSet => row.kind === "set");
  const sections = rows.filter(
    (row): row is TryoutSection => row.kind === "section"
  );

  if (!set || sections.length === 0) {
    throw new Error("Expected the start catalog set and section fixtures.");
  }

  return { sections, set };
}

describe("tryout/inventory", () => {
  it("proves a complete signed set inventory", () => {
    const { sections, set } = inventoryFixture();

    expect(provesSetInventory(set, sections)).toBe(true);
  });

  it("rejects a missing section, a short question count, and a hidden section", () => {
    const { sections, set } = inventoryFixture();
    const [section] = sections;

    if (!section) {
      throw new Error("Expected the start catalog section fixture.");
    }

    expect(provesSetInventory(set, [])).toBe(false);
    expect(provesSetInventory(set, [{ ...section, questionCount: 0 }])).toBe(
      false
    );
    expect(
      provesSetInventory(set, [{ ...section, visibility: "internal-entry" }])
    ).toBe(false);
  });
});
