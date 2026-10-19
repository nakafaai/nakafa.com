import { describe, expect, it } from "@effect/vitest";
import { GrantRejected } from "@repo/backend/confect/access/errors";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Result } from "effect";
import { saveSchool } from "@/components/tenant/settings/save.client";

const GENERIC_ERROR = {
  description: "action-error.description",
  title: "action-error.title",
};

describe("saveSchool", () => {
  it("hands the answer of a saved change to the success handler", async () => {
    const onSaved = vi.fn();

    await saveSchool(
      () => Promise.resolve(Result.succeed("saved")),
      "test",
      onSaved
    );

    expect(onSaved).toHaveBeenCalledWith("saved");
  });

  it("shows the copy of a refusal that has copy of its own", async () => {
    const error = vi.spyOn(toast, "error");

    await saveSchool(
      () => Promise.resolve(Result.fail({ _tag: "PersonNotStudent" })),
      "test"
    );

    expect(error).toHaveBeenCalledWith({
      description: "school-refusal-not-student.description",
      title: "school-refusal-not-student.title",
    });
    error.mockRestore();
  });

  it("shows the copy of a grant refusal by its code", async () => {
    const error = vi.spyOn(toast, "error");

    await saveSchool(
      () =>
        Promise.resolve(
          Result.fail(
            new GrantRejected({
              code: "LAST_OWNER",
              message: "The last owner cannot be removed.",
            })
          )
        ),
      "test"
    );

    expect(error).toHaveBeenCalledWith({
      description: "school-refusal-last-owner.description",
      title: "school-refusal-last-owner.title",
    });
    error.mockRestore();
  });

  it("shows the copy of a period refusal, not the generic error", async () => {
    const error = vi.spyOn(toast, "error");

    await saveSchool(
      () => Promise.resolve(Result.fail({ _tag: "PeriodOverlaps" })),
      "test"
    );

    expect(error).toHaveBeenCalledWith({
      description: "school-refusal-period-overlaps.description",
      title: "school-refusal-period-overlaps.title",
    });
    error.mockRestore();
  });

  it("shows the generic save error for a refusal with no copy of its own", async () => {
    const error = vi.spyOn(toast, "error");

    await saveSchool(
      () => Promise.resolve(Result.fail({ _tag: "AccessDenied" })),
      "test"
    );

    expect(error).toHaveBeenCalledWith(GENERIC_ERROR);
    error.mockRestore();
  });

  it("shows the generic save error for a call that does not complete", async () => {
    const error = vi.spyOn(toast, "error");

    await saveSchool(() => Promise.reject(new Error("offline")), "test");

    expect(error).toHaveBeenCalledWith(GENERIC_ERROR);
    error.mockRestore();
  });
});
