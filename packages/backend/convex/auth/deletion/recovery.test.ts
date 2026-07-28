import { recoverAccountDeletionProgram } from "@repo/backend/convex/auth/deletion/recovery";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

describe("auth/deletion/recovery", () => {
  it("cancels preparation while the auth user still exists", async () => {
    const cancel = vi.fn(async () => false);
    const finalize = vi.fn(async () => undefined);
    const reschedule = vi.fn(async () => undefined);

    await Effect.runPromise(
      recoverAccountDeletionProgram({
        authUserExists: vi.fn(async () => true),
        cancel,
        finalize,
        reschedule,
      })
    );

    expect(cancel).toHaveBeenCalledOnce();
    expect(finalize).not.toHaveBeenCalled();
    expect(reschedule).not.toHaveBeenCalled();
  });

  it("finalizes preparation after the auth user is gone", async () => {
    const cancel = vi.fn(async () => false);
    const finalize = vi.fn(async () => undefined);
    const reschedule = vi.fn(async () => undefined);

    await Effect.runPromise(
      recoverAccountDeletionProgram({
        authUserExists: vi.fn(async () => false),
        cancel,
        finalize,
        reschedule,
      })
    );

    expect(cancel).not.toHaveBeenCalled();
    expect(finalize).toHaveBeenCalledOnce();
    expect(reschedule).not.toHaveBeenCalled();
  });

  it("reschedules a failed auth lookup", async () => {
    const cancel = vi.fn(async () => false);
    const finalize = vi.fn(async () => undefined);
    const reschedule = vi.fn(async () => undefined);

    await Effect.runPromise(
      recoverAccountDeletionProgram({
        authUserExists: vi.fn(() =>
          Promise.reject(new Error("auth unavailable"))
        ),
        cancel,
        finalize,
        reschedule,
      })
    );

    expect(cancel).not.toHaveBeenCalled();
    expect(finalize).not.toHaveBeenCalled();
    expect(reschedule).toHaveBeenCalledOnce();
  });

  it("returns a typed failure when recovery cannot be rescheduled", async () => {
    const failure = await Effect.runPromise(
      recoverAccountDeletionProgram({
        authUserExists: vi.fn(() =>
          Promise.reject(new Error("auth unavailable"))
        ),
        cancel: vi.fn(async () => false),
        finalize: vi.fn(async () => undefined),
        reschedule: vi.fn(() =>
          Promise.reject(new Error("scheduler unavailable"))
        ),
      }).pipe(Effect.flip)
    );

    expect(failure).toMatchObject({
      _tag: "UserCleanupError",
      code: "USER_CLEANUP_FAILED",
      message: "scheduler unavailable",
    });
  });

  it("drains every bounded cancellation batch", async () => {
    const cancel = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await Effect.runPromise(
      recoverAccountDeletionProgram({
        authUserExists: vi.fn(async () => true),
        cancel,
        finalize: vi.fn(async () => undefined),
        reschedule: vi.fn(async () => undefined),
      })
    );

    expect(cancel).toHaveBeenCalledTimes(3);
  });
});
