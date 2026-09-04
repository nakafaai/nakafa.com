import { describe, expect, it } from "@effect/vitest";
import { NextRequest } from "next/server";
import { readSchoolAuthRedirect } from "@/lib/auth/school";

function schoolRequest(path: string, cookie?: string) {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie === undefined ? undefined : { cookie },
  });
}

describe("School auth redirect", () => {
  it.each([
    [
      "/id/school/classes/algebra/forum?q=persamaan&sort=new",
      "http://localhost:3000/id/auth?redirect=%2Fid%2Fschool%2Fclasses%2Falgebra%2Fforum%3Fq%3Dpersamaan%26sort%3Dnew",
    ],
    [
      "/school/classes/algebra/forum?q=linear%20equations&sort=top",
      "http://localhost:3000/en/auth?redirect=%2Fen%2Fschool%2Fclasses%2Falgebra%2Fforum%3Fq%3Dlinear%2520equations%26sort%3Dtop",
    ],
  ])("preserves the protected request %s", (path, expected) => {
    expect(readSchoolAuthRedirect(schoolRequest(path))?.href).toBe(expected);
  });

  it.each(["/", "/search", "/en/school"])(
    "leaves the public route %s alone",
    (path) => {
      expect(readSchoolAuthRedirect(schoolRequest(path))).toBeNull();
    }
  );

  it("leaves authenticated School requests alone", () => {
    expect(
      readSchoolAuthRedirect(
        schoolRequest(
          "/en/school/classes/algebra",
          "better-auth.session_token=fixture-session"
        )
      )
    ).toBeNull();
  });
});
