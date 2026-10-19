import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { roomsArgs } from "@/components/tenant/exams/rooms.client";

const input = {
  examId: Schema.decodeUnknownSync(Id("exams"))("exam-pts"),
  slug: Schema.decodeSync(TenantSlug)("nf"),
};

describe("exams/rooms client", () => {
  it("asks for every room of the exam when the filter names every state, with no state argument", () => {
    const args = roomsArgs(input, "all");
    expect(args).toEqual(input);
    expect(args).not.toHaveProperty("state");
  });

  it("asks for the rooms of one state when the filter names it", () => {
    expect(roomsArgs(input, "open")).toEqual({ ...input, state: "open" });
  });
});
