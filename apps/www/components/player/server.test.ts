// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { PLAYER_MODE_COOKIE } from "@/components/player/mode";
import { readPlayerMode } from "@/components/player/server";

const headers = vi.hoisted(() => ({ cookies: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: headers.cookies }));

/** Makes the request carry these cookies, by name and value. */
function carry(values: Record<string, string>) {
  headers.cookies.mockResolvedValue({
    get: (name: string) =>
      name in values ? { name, value: values[name] } : undefined,
  });
}

describe("readPlayerMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lets the address win over the saved view", async () => {
    carry({ [PLAYER_MODE_COOKIE]: "single" });

    expect(await readPlayerMode({ kind: "valid", mode: "list" })).toBe("list");
  });

  it("uses the saved view when the address names none", async () => {
    carry({ [PLAYER_MODE_COOKIE]: "single" });

    expect(await readPlayerMode({ kind: "absent" })).toBe("single");
  });

  it("starts with the list without a saved view or with an unknown one", async () => {
    carry({});
    expect(await readPlayerMode({ kind: "absent" })).toBe("list");

    carry({ [PLAYER_MODE_COOKIE]: "grid" });
    expect(await readPlayerMode({ kind: "absent" })).toBe("list");
  });
});
