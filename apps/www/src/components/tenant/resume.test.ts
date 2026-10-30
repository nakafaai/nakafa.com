import { describe, expect, it } from "@effect/vitest";
import { signInReturn } from "@/components/tenant/resume";

describe("signInReturn", () => {
  it("resumes the exam room the student opened, without the scanned code", () => {
    expect(signInReturn("/sittings/w17dbtag#X26U2H")).toBe(
      "/sittings/w17dbtag"
    );
  });

  it("drops only the switch of the username form from the query", () => {
    expect(signInReturn("/sittings/w17dbtag?masuk=username&tab=1")).toBe(
      "/sittings/w17dbtag?tab=1"
    );
    expect(signInReturn("/?masuk=username")).toBe("/");
  });

  it("reads the browser's full address as well as the router's", () => {
    expect(
      signInReturn(
        "http://acc-1.localhost:3000/sittings/w17dbtag?masuk=username"
      )
    ).toBe("/sittings/w17dbtag");
  });
});
