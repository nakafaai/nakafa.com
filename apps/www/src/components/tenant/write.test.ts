import { describe, expect, it } from "@effect/vitest";
import { captureException } from "@repo/analytics/posthog/capture";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Data, Effect, Result } from "effect";
import {
  failSchoolAction,
  runSchoolWrite,
  SchoolCallFailed,
  schoolCall,
} from "@/components/tenant/write";

vi.mock("@repo/analytics/posthog/capture", () => ({
  captureException: vi.fn(),
}));

const ACTION_ERROR = {
  description: "action-error.description",
  title: "action-error.title",
};

/** A refusal the server returns, with its own copy in the School's table. */
class Refused extends Data.TaggedError("PersonNotStudent") {}

const refused = (): Promise<Result.Result<string, Refused>> =>
  Promise.resolve(Result.fail(new Refused()));

describe("runSchoolWrite", () => {
  it("starts the call after the caller's turn, so a transition holds no optimistic change back", async () => {
    const send = vi.fn(() => Promise.resolve(Result.succeed("saved")));

    const saving = runSchoolWrite(schoolCall(send));

    expect(send).not.toHaveBeenCalled();
    await saving;
    expect(send).toHaveBeenCalledOnce();
  });

  it("hands the answer of a kept write to onSaved and says nothing", async () => {
    const error = vi.spyOn(toast, "error");
    const onSaved = vi.fn();

    await runSchoolWrite(
      schoolCall(() => Promise.resolve(Result.succeed("saved"))),
      { onSaved }
    );

    expect(onSaved).toHaveBeenCalledWith("saved");
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("restores the page on any failure and shows the refusal's own copy", async () => {
    const error = vi.spyOn(toast, "error");
    const onFailed = vi.fn();

    await runSchoolWrite(schoolCall(refused), { onFailed });

    expect(onFailed.mock.calls[0]?.[0]).toBeInstanceOf(Refused);
    expect(error).toHaveBeenCalledWith({
      description: "school-refusal-not-student.description",
      title: "school-refusal-not-student.title",
    });
    error.mockRestore();
  });

  it("hands the copy to the page in place of the toast, so a dialog says why and stays open", async () => {
    const error = vi.spyOn(toast, "error");
    const onRefused = vi.fn();

    await runSchoolWrite(schoolCall(refused), { onRefused });

    expect(onRefused).toHaveBeenCalledWith({
      description: "school-refusal-not-student.description",
      title: "school-refusal-not-student.title",
    });
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("settles a call that does not complete as the action error", async () => {
    const error = vi.spyOn(toast, "error");
    const onFailed = vi.fn();

    const offline = (): Promise<Result.Result<string, never>> =>
      Promise.reject(new Error("offline"));

    await runSchoolWrite(schoolCall(offline), { onFailed });

    expect(onFailed.mock.calls[0]?.[0]).toBeInstanceOf(SchoolCallFailed);
    expect(error).toHaveBeenCalledWith(ACTION_ERROR);
    error.mockRestore();
  });

  it("runs a write that is an effect of its own, such as one that reads the clock first", async () => {
    const onSaved = vi.fn();

    await runSchoolWrite(Effect.succeed(7), { onSaved });

    expect(onSaved).toHaveBeenCalledWith(7);
  });

  it("says what failed before reporting it, so a reporter that throws hides nothing", async () => {
    const onRefused = vi.fn();
    vi.mocked(captureException).mockImplementationOnce(() => {
      throw new Error("analytics unavailable");
    });

    await runSchoolWrite(schoolCall(refused), { onRefused });

    expect(onRefused).toHaveBeenCalledOnce();
    expect(captureException).toHaveBeenCalled();
  });
});

describe("failSchoolAction", () => {
  it.effect("shows the copy an action names, then reports the failure", () =>
    Effect.gen(function* () {
      const error = vi.spyOn(toast, "error");
      vi.mocked(captureException).mockClear();

      yield* failSchoolAction(new Error("disk full"), {
        title: "school-roster-export-failed.title",
      });

      expect(error).toHaveBeenCalledWith({
        title: "school-roster-export-failed.title",
      });
      expect(captureException).toHaveBeenCalledOnce();
      error.mockRestore();
    })
  );

  it.effect("shows the refusal's own copy when the action names none", () =>
    Effect.gen(function* () {
      const error = vi.spyOn(toast, "error");

      yield* failSchoolAction({ _tag: "ExamInUse" });

      expect(error).toHaveBeenCalledWith({
        description: "exam-in-use.description",
        title: "exam-in-use.title",
      });
      error.mockRestore();
    })
  );
});
