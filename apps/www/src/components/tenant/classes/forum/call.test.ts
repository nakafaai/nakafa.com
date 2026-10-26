import { describe, expect, it } from "@effect/vitest";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Result } from "effect";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";

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
