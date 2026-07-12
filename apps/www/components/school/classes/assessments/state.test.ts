import { describe, expect, it } from "vitest";
import { updateAssessmentState } from "@/components/school/classes/assessments/state";

const assessment = {
  description: {
    format: "plate-v1" as const,
    json: "[]",
    text: "Original",
  },
  mode: "assignment" as const,
  scheduledAt: undefined,
  status: "draft" as const,
  title: "Original",
  updatedAt: 1,
};

describe("updateAssessmentState", () => {
  it("applies edited fields and a scheduled timestamp", () => {
    expect(
      updateAssessmentState(
        assessment,
        {
          description: {
            format: "plate-v1",
            json: "[]",
            text: "Next",
          },
          mode: "quiz",
          scheduledAt: 500,
          status: "scheduled",
          title: "Next",
        },
        100
      )
    ).toMatchObject({
      description: { text: "Next" },
      mode: "quiz",
      scheduledAt: 500,
      status: "scheduled",
      title: "Next",
      updatedAt: 100,
    });
  });

  it("uses existing values for omitted fields", () => {
    expect(
      updateAssessmentState(
        { ...assessment, scheduledAt: 500, status: "scheduled" as const },
        {},
        100
      )
    ).toMatchObject({
      description: assessment.description,
      mode: "assignment",
      scheduledAt: 500,
      status: "scheduled",
      title: "Original",
    });
  });

  it("clears scheduling when status leaves scheduled", () => {
    expect(
      updateAssessmentState(
        { ...assessment, scheduledAt: 500, status: "scheduled" as const },
        {
          status: "published",
        },
        100
      ).scheduledAt
    ).toBeUndefined();
  });
});
