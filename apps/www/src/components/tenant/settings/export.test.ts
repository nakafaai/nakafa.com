import { describe, expect, it } from "@effect/vitest";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Schema } from "effect";
import { TestClock } from "effect/testing";
import {
  auditFileName,
  csvText,
  entryTime,
  readAuditTrail,
} from "@/components/tenant/settings/export";

const client = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("@/lib/convex/client", () => ({
  readConvexClient: () => client,
}));

const slug = Schema.decodeSync(TenantSlug)("harapan");

/** One encoded journal entry, as the server sends it. */
const entry = (id: string, at: number) => ({
  actor: { kind: "system" },
  at,
  change: { type: "tenant.provisioned" },
  id,
  subject: { kind: "tenant" },
  subjectName: null,
});

describe("components/tenant/settings/export", () => {
  it.effect("reads every page of the trail until the journal is done", () =>
    Effect.gen(function* () {
      client.query
        .mockResolvedValueOnce({
          continueCursor: "next",
          isDone: false,
          page: [entry("e1", 2)],
        })
        .mockResolvedValueOnce({
          continueCursor: "end",
          isDone: true,
          page: [entry("e2", 1)],
        });
      const entries = yield* readAuditTrail(slug);
      expect(entries.map((read) => read.id)).toEqual(["e1", "e2"]);
      expect(client.query).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        expect.objectContaining({
          paginationOpts: { cursor: "next", numItems: 200 },
        })
      );
    })
  );

  it("quotes separators and keeps a formula start as text", () => {
    expect(
      csvText([
        ["When", "Who"],
        ['Ana, "Bu"', "=1+1"],
      ])
    ).toBe('\uFEFFWhen,Who\r\n"Ana, ""Bu""",\'=1+1\r\n');
  });

  it("writes an entry's time in UTC", () => {
    expect(entryTime(0)).toBe("1970-01-01T00:00:00.000Z");
  });

  it.effect("names the file by the school and the day", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(Date.UTC(2026, 9, 26, 9));
      expect(yield* auditFileName(slug)).toBe("audit-harapan-2026-10-26.csv");
    })
  );
});
