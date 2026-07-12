import { describe, expect, it } from "vitest";
import { updateMaterialGroupState } from "@/components/school/classes/materials/state";

const group = {
  description: "Original",
  name: "Original",
  scheduledAt: undefined,
  status: "draft" as const,
  updatedAt: 1,
};

describe("updateMaterialGroupState", () => {
  it("applies edited fields and a scheduled timestamp", () => {
    expect(
      updateMaterialGroupState(
        group,
        {
          description: "Next",
          name: "Next",
          scheduledAt: 500,
          status: "scheduled",
        },
        100
      )
    ).toMatchObject({
      description: "Next",
      name: "Next",
      scheduledAt: 500,
      status: "scheduled",
      updatedAt: 100,
    });
  });

  it("uses existing values for omitted fields", () => {
    expect(
      updateMaterialGroupState(
        { ...group, scheduledAt: 500, status: "scheduled" as const },
        {},
        100
      )
    ).toMatchObject({
      description: "Original",
      name: "Original",
      scheduledAt: 500,
      status: "scheduled",
    });
  });

  it("clears scheduling when status leaves scheduled", () => {
    expect(
      updateMaterialGroupState(
        { ...group, scheduledAt: 500, status: "scheduled" as const },
        { status: "published" },
        100
      ).scheduledAt
    ).toBeUndefined();
  });
});
