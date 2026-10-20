import { describe, expect, it } from "@effect/vitest";
import { GrantRejected } from "@repo/backend/confect/access/errors";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Result } from "effect";
import { saveSchool } from "@/components/tenant/settings/save.client";

const GENERIC_ERROR = {
  description: "action-error.description",
  title: "action-error.title",
};

const ACCESS_COPY = {
  description: "school-refusal-access.description",
  title: "school-refusal-access.title",
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

  it("shows the access copy when the viewer's role no longer allows the save", async () => {
    const error = vi.spyOn(toast, "error");

    await saveSchool(
      () => Promise.resolve(Result.fail({ _tag: "AccessDenied" })),
      "test"
    );

    expect(error).toHaveBeenCalledWith(ACCESS_COPY);
    error.mockRestore();
  });

  it("shows the access copy when the viewer is no longer a member of the school", async () => {
    const error = vi.spyOn(toast, "error");

    await saveSchool(
      () => Promise.resolve(Result.fail({ _tag: "NotMember" })),
      "test"
    );

    expect(error).toHaveBeenCalledWith(ACCESS_COPY);
    error.mockRestore();
  });

  it("shows the copy of a promotion that is not applied to the period yet", async () => {
    const error = vi.spyOn(toast, "error");

    await saveSchool(
      () => Promise.resolve(Result.fail({ _tag: "PromotionState" })),
      "test"
    );

    expect(error).toHaveBeenCalledWith({
      description: "school-refusal-promotion-state.description",
      title: "school-refusal-promotion-state.title",
    });
    error.mockRestore();
  });

  it("shows the copy of a logo the server did not save", async () => {
    const error = vi.spyOn(toast, "error");

    await saveSchool(
      () => Promise.resolve(Result.fail({ _tag: "LogoNotSaved" })),
      "test"
    );

    expect(error).toHaveBeenCalledWith({ title: "school-logo-refused.title" });
    error.mockRestore();
  });

  it("shows the copy of an action the catalog does not open to clients", async () => {
    const error = vi.spyOn(toast, "error");

    await saveSchool(
      () => Promise.resolve(Result.fail({ _tag: "ActionClosed" })),
      "test"
    );

    expect(error).toHaveBeenCalledWith({
      description: "school-refusal-action-closed.description",
      title: "school-refusal-action-closed.title",
    });
    error.mockRestore();
  });

  it("shows the generic save error for a refusal that no copy names", async () => {
    const error = vi.spyOn(toast, "error");

    await saveSchool(
      () => Promise.resolve(Result.fail({ _tag: "UnnamedRefusal" })),
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
