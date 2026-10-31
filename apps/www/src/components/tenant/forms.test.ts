import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { loadEntryForm } from "@/components/tenant/forms";

const loaded = vi.hoisted(() => ({ guardian: vi.fn(), login: vi.fn() }));

vi.mock("@/components/tenant/login", () => {
  loaded.login();
  return { TenantLogin: () => null };
});

vi.mock("@/components/tenant/guardian/signin", () => {
  loaded.guardian();
  return { TenantGuardianSignIn: () => null };
});

describe("components/tenant/forms", () => {
  it.effect("loads no form for the entry that offers Google", () =>
    Effect.gen(function* () {
      yield* Effect.promise(() =>
        loadEntryForm({ guardian: false, signIn: undefined })
      );
      expect(loaded.login).not.toHaveBeenCalled();
      expect(loaded.guardian).not.toHaveBeenCalled();
    })
  );

  it.effect("loads only the parent's code form at the parent address", () =>
    Effect.gen(function* () {
      yield* Effect.promise(() =>
        loadEntryForm({ guardian: true, signIn: "username" })
      );
      expect(loaded.guardian).toHaveBeenCalledOnce();
      expect(loaded.login).not.toHaveBeenCalled();
    })
  );

  it.effect("loads the username form at its sign-in address", () =>
    Effect.gen(function* () {
      yield* Effect.promise(() =>
        loadEntryForm({ guardian: false, signIn: "username" })
      );
      expect(loaded.login).toHaveBeenCalledOnce();
    })
  );
});
