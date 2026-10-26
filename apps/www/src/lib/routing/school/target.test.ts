import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import {
  schoolClassChannelTarget,
  schoolClassDiscussionTarget,
  schoolClassForumTarget,
  schoolClassTarget,
  schoolExamEditTarget,
  schoolExamSittingResultsTarget,
  schoolExamSittingTarget,
  schoolExamsTarget,
  schoolExamTarget,
  schoolHomeTarget,
  schoolSittingTarget,
} from "@/lib/routing/school/target";

const slug = Schema.decodeSync(TenantSlug)("harapan");

describe("school targets", () => {
  it("builds the school home and the exam pages under the school's slug", () => {
    expect(schoolHomeTarget(slug)).toEqual(
      expect.objectContaining({ params: { slug }, to: "/school/$slug" })
    );
    expect(schoolExamsTarget(slug)).toEqual(
      expect.objectContaining({
        params: { slug },
        to: "/school/$slug/exams",
      })
    );
    expect(schoolExamTarget(slug, "e1")).toEqual(
      expect.objectContaining({
        params: { exam: "e1", slug },
        to: "/school/$slug/exams/$exam",
      })
    );
    expect(schoolExamEditTarget(slug, "e1")).toEqual(
      expect.objectContaining({
        params: { exam: "e1", slug },
        to: "/school/$slug/exams/$exam/edit",
      })
    );
  });

  it("builds the sitting, results, student sitting and class pages", () => {
    expect(schoolExamSittingTarget(slug, "e1", "s1")).toEqual(
      expect.objectContaining({
        params: { exam: "e1", sitting: "s1", slug },
        to: "/school/$slug/exams/$exam/sittings/$sitting",
      })
    );
    expect(schoolExamSittingResultsTarget(slug, "e1", "s1")).toEqual(
      expect.objectContaining({
        params: { exam: "e1", sitting: "s1", slug },
        to: "/school/$slug/exams/$exam/sittings/$sitting/results",
      })
    );
    expect(schoolSittingTarget(slug, "s1")).toEqual(
      expect.objectContaining({
        params: { sitting: "s1", slug },
        to: "/school/$slug/sittings/$sitting",
      })
    );
    expect(schoolClassTarget(slug, "7a")).toEqual(
      expect.objectContaining({
        params: { classSlug: "7a", slug },
        to: "/school/$slug/classes/$classSlug",
      })
    );
    expect(schoolClassForumTarget(slug, "7a")).toEqual(
      expect.objectContaining({
        params: { classSlug: "7a", slug },
        to: "/school/$slug/classes/$classSlug/forum",
      })
    );
    const channel = Schema.decodeUnknownSync(Id("classroomChannels"))("umum");
    expect(schoolClassChannelTarget(slug, "7a", channel)).toEqual(
      expect.objectContaining({
        params: { classSlug: "7a", slug },
        search: { channel },
        to: "/school/$slug/classes/$classSlug/forum",
      })
    );
    expect(schoolClassDiscussionTarget(slug, "7a", 12)).toEqual(
      expect.objectContaining({
        params: { classSlug: "7a", number: "12", slug },
        to: "/school/$slug/classes/$classSlug/forum/$number",
      })
    );
  });
});
