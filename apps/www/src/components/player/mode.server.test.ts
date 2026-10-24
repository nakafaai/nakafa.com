// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { PLAYER_MODE_COOKIE } from "@/components/player/mode";
import { readPlayerMode } from "@/components/player/mode.server";

const cookies = vi.hoisted(() => ({ getCookie: vi.fn() }));

vi.mock("@tanstack/react-start/server", () => ({
  getCookie: cookies.getCookie,
}));

/** Makes the request carry these cookies, by name and value. */
function carry(values: Record<string, string>) {
  cookies.getCookie.mockImplementation((name: string) => values[name]);
}

describe("readPlayerMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lets the address win over the saved view", () => {
    carry({ [PLAYER_MODE_COOKIE]: "single" });

    expect(readPlayerMode({ kind: "valid", mode: "list" })).toBe("list");
  });

  it("uses the saved view when the address names none", () => {
    carry({ [PLAYER_MODE_COOKIE]: "single" });

    expect(readPlayerMode({ kind: "absent" })).toBe("single");
  });

  it("starts with the list without a saved view or with an unknown one", () => {
    carry({});
    expect(readPlayerMode({ kind: "absent" })).toBe("list");

    carry({ [PLAYER_MODE_COOKIE]: "grid" });
    expect(readPlayerMode({ kind: "absent" })).toBe("list");
  });
});
