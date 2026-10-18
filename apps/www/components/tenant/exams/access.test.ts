import { describe, expect, it } from "@effect/vitest";
import { GrantView } from "@repo/backend/confect/access/schema";
import { Schema } from "effect";
import { canOpenExams } from "@/components/tenant/exams/access";

/** One standing grant of the given role, as the viewer's grants arrive. */
const grantOf = (key: "student" | "teacher" | "admin") =>
  Schema.decodeUnknownSync(GrantView)({
    id: "grant-1",
    role: { key, kind: "builtin" },
    scope: { kind: "tenant" },
    term: { kind: "standing" },
  });

describe("canOpenExams", () => {
  it("opens the exams for a teacher", () => {
    expect(canOpenExams([grantOf("teacher")])).toBe(true);
  });

  it("opens the exams when one grant of several is not a student's", () => {
    expect(canOpenExams([grantOf("student"), grantOf("admin")])).toBe(true);
  });

  it("keeps the exams from a student alone", () => {
    expect(canOpenExams([grantOf("student")])).toBe(false);
  });

  it("keeps the exams from a viewer with no grant", () => {
    expect(canOpenExams([])).toBe(false);
  });
});
