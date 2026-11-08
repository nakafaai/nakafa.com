import { describe, expect, it } from "@effect/vitest";
import { GrantRejected } from "@repo/backend/confect/access/errors";
import { CohortInUse, PeriodInUse } from "@repo/backend/confect/tenancy/errors";
import { toast } from "@repo/design-system/lib/toast/notify";
import { refusalCopy, toastRefusal } from "@/components/tenant/refusal/copy";

const ACTION_ERROR = {
  description: "action-error.description",
  title: "action-error.title",
};

const ACCESS_COPY = {
  description: "school-refusal-access.description",
  title: "school-refusal-access.title",
};

describe("refusalCopy", () => {
  it("names a refusal of settings, of a class and of an exam by its own copy, from one table", () => {
    expect(refusalCopy({ _tag: "PeriodOverlaps" })).toEqual({
      description: "school-refusal-period-overlaps.description",
      title: "school-refusal-period-overlaps.title",
    });
    expect(refusalCopy({ _tag: "TaskClosed" })).toEqual({
      description: "classroom-refusal-task-closed.description",
      title: "classroom-refusal-task-closed.title",
    });
    expect(refusalCopy({ _tag: "ScheduleInvalid" })).toEqual({
      description: "school-refusal-schedule-invalid.description",
      title: "school-refusal-schedule-invalid.title",
    });
    expect(refusalCopy({ _tag: "ExamInUse" })).toEqual({
      description: "exam-in-use.description",
      title: "exam-in-use.title",
    });
    expect(refusalCopy({ _tag: "LogoNotSaved" })).toEqual({
      title: "school-logo-refused.title",
    });
  });

  it("names a lost access in the same words, whether the role or the membership went", () => {
    expect(refusalCopy({ _tag: "AccessDenied" })).toEqual(ACCESS_COPY);
    expect(refusalCopy({ _tag: "NotMember" })).toEqual(ACCESS_COPY);
  });

  it("names a refused grant by its code", () => {
    expect(
      refusalCopy(
        new GrantRejected({
          code: "LAST_OWNER",
          message: "The school keeps one owner.",
        })
      )
    ).toEqual({
      description: "school-refusal-last-owner.description",
      title: "school-refusal-last-owner.title",
    });
  });

  it("names what keeps a cohort or a period in use, so the person knows what to clear or to archive it", () => {
    expect(refusalCopy(new CohortInUse({ holds: "members" }))).toEqual({
      description: "school-refusal-cohort-in-use-members.description",
      title: "school-refusal-cohort-in-use-members.title",
    });
    expect(refusalCopy(new PeriodInUse({ holds: "active" }))).toEqual({
      description: "school-refusal-period-in-use-active.description",
      title: "school-refusal-period-in-use-active.title",
    });
  });

  it("names a refusal no copy names, and anything that is no refusal, by the action error", () => {
    expect(refusalCopy({ _tag: "UnnamedRefusal" })).toEqual(ACTION_ERROR);
    expect(refusalCopy(new Error("offline"))).toEqual(ACTION_ERROR);
    expect(refusalCopy(undefined)).toEqual(ACTION_ERROR);
  });
});

describe("toastRefusal", () => {
  it("shows the action error toast every School action uses for a failure with no refusal", () => {
    const error = vi.spyOn(toast, "error");

    toastRefusal();

    expect(error).toHaveBeenCalledWith(ACTION_ERROR);
    error.mockRestore();
  });
});
