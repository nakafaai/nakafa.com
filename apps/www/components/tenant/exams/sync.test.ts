import { describe, expect, it } from "@effect/vitest";
import { createPromptSync } from "@/components/tenant/exams/sync";

describe("createPromptSync", () => {
  it("has no session until the server opens one", () => {
    const sync = createPromptSync();

    expect(sync.getState().clientId).toBeNull();
    expect(sync.getState().version).toBe(0);
  });

  it("records the session the server opened at the version the editor holds", () => {
    const sync = createPromptSync();

    sync.getState().open("client-1", 4);

    expect(sync.getState().clientId).toBe("client-1");
    expect(sync.getState().version).toBe(4);
  });

  it("moves the session to a new version", () => {
    const sync = createPromptSync();
    sync.getState().open("client-1", 4);

    sync.getState().advance(7);

    expect(sync.getState().clientId).toBe("client-1");
    expect(sync.getState().version).toBe(7);
  });
});
