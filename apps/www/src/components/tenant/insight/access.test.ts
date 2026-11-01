import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import type { BuiltinRole } from "@repo/backend/confect/access/schema";
import { Schema } from "effect";
import {
  canOpenInsight,
  readsEveryClass,
} from "@/components/tenant/insight/access";
import type { SchoolViewer } from "@/lib/tenant/frame";

/** A viewer who holds one role in the school. */
const holding = (key: BuiltinRole): Pick<SchoolViewer, "grants"> => ({
  grants: [
    {
      id: Schema.decodeUnknownSync(Id("tenantGrants"))("grant-1"),
      role: { key, kind: "builtin" },
      scope: { kind: "tenant" },
      term: { kind: "standing" },
    },
  ],
});

describe("tenant/insight/access", () => {
  it("lets a leader read the school's classes, and a teacher only their own", () => {
    expect(readsEveryClass(holding("counselor"))).toBe(true);
    expect(readsEveryClass(holding("teacher"))).toBe(false);
  });

  it("opens Insight for those it has a page for", () => {
    expect(canOpenInsight(holding("owner"))).toBe(true);
    expect(canOpenInsight(holding("teacher"))).toBe(true);
    expect(canOpenInsight(holding("student"))).toBe(true);
    expect(canOpenInsight(holding("proctor"))).toBe(false);
    expect(canOpenInsight(holding("guardian"))).toBe(false);
    expect(canOpenInsight({ grants: [] })).toBe(false);
  });
});
