import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import {
  focusFirst,
  memoryRowId,
} from "@/components/user/settings/memory/focus";

const memoryId = Schema.decodeUnknownSync(Id("ninaMemories"));

describe("memory focus", () => {
  it("names each memory's row by the memory, and the same memory always the same way", () => {
    expect(memoryRowId(memoryId("first"))).toBe(memoryRowId(memoryId("first")));
    expect(memoryRowId(memoryId("first"))).not.toBe(
      memoryRowId(memoryId("second"))
    );
  });

  it("gives the focus to the first candidate that takes it, skipping a missing or disabled one", () => {
    document.body.innerHTML =
      '<button disabled id="off" type="button"></button><button id="on" type="button"></button>';

    focusFirst([
      null,
      document.getElementById("off"),
      document.getElementById("on"),
    ]);

    expect(document.activeElement?.id).toBe("on");
  });

  it("leaves the focus where it is when no candidate takes it", () => {
    document.body.innerHTML =
      '<button disabled id="off" type="button"></button>';

    focusFirst([null, document.getElementById("off")]);

    expect(document.activeElement).toBe(document.body);
  });
});
