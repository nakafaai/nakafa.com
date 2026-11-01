import { describe, expect, it } from "@effect/vitest";
import { holdsOffline } from "@/lib/routing/offline";

describe("holdsOffline", () => {
  it("holds a move to another page without a network", () => {
    expect(holdsOffline(false, "/exams", "/settings/members")).toBe(true);
  });

  it("lets a move inside one page go on without a network", () => {
    expect(holdsOffline(false, "/sittings/one", "/sittings/one")).toBe(false);
  });

  it("lets every move go on with a network", () => {
    expect(holdsOffline(true, "/exams", "/settings/members")).toBe(false);
  });
});
