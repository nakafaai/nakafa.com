import { describe, expect, it } from "@effect/vitest";
import { roomJoinAddress } from "@/components/exams/sitting/join";

describe("roomJoinAddress", () => {
  it("opens the sitting on the proctor's school host, with the token after the hash", () => {
    expect(
      roomJoinAddress("https://harapan.nakafa.com", "w17dbtag", "X26U2H")
    ).toBe("https://harapan.nakafa.com/sittings/w17dbtag#X26U2H");
  });

  it("keeps the port of a local school host", () => {
    expect(
      roomJoinAddress("http://acc-1.localhost:3000", "w17dbtag", "X26U2H")
    ).toBe("http://acc-1.localhost:3000/sittings/w17dbtag#X26U2H");
  });
});
