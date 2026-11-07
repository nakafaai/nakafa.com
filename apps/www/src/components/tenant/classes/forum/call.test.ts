import { describe, expect, it } from "@effect/vitest";
import { captureException } from "@repo/analytics/posthog/capture";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Result } from "effect";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";

vi.mock("@repo/analytics/posthog/capture", () => ({
  captureException: vi.fn(),
}));

describe("runForumCall", () => {
  it("leaves a call that succeeds alone", async () => {
    const onFailure = vi.fn();
    const send = (): Promise<Result.Result<string, string>> =>
      Promise.resolve(Result.succeed("sent"));

    await runForumCall(forumCall(send), onFailure);

    expect(onFailure).not.toHaveBeenCalled();
  });

  it("settles a refused call and a call that does not complete with the failure handler", async () => {
    const onFailure = vi.fn();
    const refused = (): Promise<Result.Result<string, string>> =>
      Promise.resolve(Result.fail("refused"));
    const offline = (): Promise<Result.Result<string, string>> =>
      Promise.reject(new Error("offline"));

    await runForumCall(forumCall(refused), onFailure);
    await runForumCall(forumCall(offline), onFailure);

    expect(onFailure).toHaveBeenCalledTimes(2);
  });
});

describe("runForumCall with a failing reporter", () => {
  it("says what failed before reporting it, so a reporter that throws hides nothing", async () => {
    const onFailure = vi.fn();
    const refused = (): Promise<Result.Result<string, string>> =>
      Promise.resolve(Result.fail("refused"));
    vi.mocked(captureException).mockImplementationOnce(() => {
      throw new Error("analytics unavailable");
    });

    await runForumCall(forumCall(refused), onFailure);

    expect(onFailure).toHaveBeenCalledOnce();
  });
});

describe("toastForumFailure", () => {
  it("shows the action-error toast every School action uses", () => {
    const error = vi.spyOn(toast, "error");

    toastForumFailure();

    expect(error).toHaveBeenCalledWith({
      description: "action-error.description",
      title: "action-error.title",
    });
    error.mockRestore();
  });
});
