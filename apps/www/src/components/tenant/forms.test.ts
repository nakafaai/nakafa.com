import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { loadEntryForm } from "@/components/tenant/forms";

const loaded = vi.hoisted(() => ({ login: vi.fn() }));

vi.mock("@/components/tenant/login", () => {
  loaded.login();
  return { TenantLogin: () => null };
});

describe("components/tenant/forms", () => {
  it.effect("loads no form for the entry that offers Google", () =>
    Effect.gen(function* () {
      yield* Effect.promise(() => loadEntryForm({ signIn: undefined }));
      expect(loaded.login).not.toHaveBeenCalled();
    })
  );

  it.effect("loads the username form at its sign-in address", () =>
    Effect.gen(function* () {
      yield* Effect.promise(() => loadEntryForm({ signIn: "username" }));
      expect(loaded.login).toHaveBeenCalledOnce();
    })
  );
});
