import { describe, expect, it } from "@effect/vitest";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect, Result } from "effect";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";

describe("runExamAction", () => {
  it("hands the value of a success to the success handler", async () => {
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    const send = (): Promise<Result.Result<string, string>> =>
      Promise.resolve(Result.succeed("saved"));

    await runExamAction(sentAction(send), { onFailure, onSuccess });

    expect(onSuccess).toHaveBeenCalledWith("saved");
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("settles a refused call with the failure handler and the action-error toast", async () => {
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    const error = vi.spyOn(toast, "error");
    const send = (): Promise<Result.Result<string, string>> =>
      Promise.resolve(Result.fail("refused"));

    await runExamAction(sentAction(send), { onFailure, onSuccess });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith({
      description: "action-error.description",
      title: "action-error.title",
    });
    error.mockRestore();
  });

  it("settles a call that does not complete the same way as a refusal", async () => {
    const onFailure = vi.fn();
    const error = vi.spyOn(toast, "error");
    const send = (): Promise<Result.Result<string, string>> =>
      Promise.reject(new Error("offline"));

    await runExamAction(sentAction(send), { onFailure, onSuccess: vi.fn() });

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it("runs an action that is an effect of its own, such as the placeholder before a create", async () => {
    const onSuccess = vi.fn();

    await runExamAction(Effect.succeed("placeholder"), {
      onFailure: vi.fn(),
      onSuccess,
    });

    expect(onSuccess).toHaveBeenCalledWith("placeholder");
  });
});
