import { describe, expect, it } from "@effect/vitest";
import { readMuted, writeMuted } from "@/lib/island/settings";

describe("island/settings", () => {
  it("keeps the sound switch in this browser, on until the learner turns it off", () => {
    localStorage.clear();
    expect(readMuted()).toBe(false);
    writeMuted(true);
    expect(readMuted()).toBe(true);
    writeMuted(false);
    expect(readMuted()).toBe(false);
  });

  it("reads sound on, and forgets the switch, when the browser refuses storage", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });
    expect(readMuted()).toBe(false);
    expect(() => writeMuted(true)).not.toThrow();
    getItem.mockRestore();
    setItem.mockRestore();
  });
});
