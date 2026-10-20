import { afterEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { signOutSchoolAccount } from "@/components/tenant/account.client";
import { AccountSignOutFailed } from "@/lib/auth/identity/browser";

const doubles = vi.hoisted(() => ({
  signOut: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/auth/client", () => ({
  readAuthClient: () => ({ signOut: vi.fn() }),
}));
vi.mock("@/lib/auth/identity/browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/identity/browser")>()),
  signOutAccountBrowserIdentity: doubles.signOut,
}));
vi.mock("@repo/design-system/lib/toast/notify", () => ({
  toast: { error: doubles.toastError },
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("signOutSchoolAccount", () => {
  it.effect(
    "answers home after a sign-out that finishes, without a message",
    () =>
      Effect.gen(function* () {
        doubles.signOut.mockReturnValue(Effect.void);

        const destination = yield* signOutSchoolAccount();

        expect(destination).toBe("home");
        expect(doubles.toastError).not.toHaveBeenCalled();
      })
  );

  it.effect("shows the message and answers stay when the sign-out fails", () =>
    Effect.gen(function* () {
      doubles.signOut.mockReturnValue(
        Effect.fail(
          new AccountSignOutFailed({ code: "ACCOUNT_SIGN_OUT_FAILED" })
        )
      );

      const destination = yield* signOutSchoolAccount();

      expect(destination).toBe("stay");
      expect(doubles.toastError).toHaveBeenCalledExactlyOnceWith(
        {
          description: "sign-out-error.description",
          title: "sign-out-error.title",
        },
        { position: "bottom-center" }
      );
    })
  );
});
