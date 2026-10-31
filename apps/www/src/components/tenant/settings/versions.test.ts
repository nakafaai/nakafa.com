import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import records from "@repo/backend/confect/_generated/refs/records";
import { Array as Arr, Option, Schema } from "effect";
import { isDraft } from "@/components/tenant/settings/state";
import {
  checkedScheme,
  draftOfScheme,
  nextEffectiveFrom,
  type SchemeVersion,
  storeSchemeChange,
} from "@/components/tenant/settings/versions";
import { createLocalStore } from "@/test/optimistic";
import { later, otherSlug, pageOf, paging, slug } from "@/test/settings";

/** A stored version in force from `effectiveFrom`, with two bands. */
const version = (id: string, effectiveFrom: number): SchemeVersion => ({
  bands: [
    { label: "Cukup", minimum: 60 },
    { label: "Baik", minimum: 80 },
  ],
  effectiveFrom,
  id: Schema.decodeUnknownSync(Id("gradingSchemes"))(id),
  kktp: 75,
});

describe("components/tenant/settings/versions", () => {
  it("fills the form with a scheme's KKTP and its bands in order, and checks it back to the same scheme", () => {
    const draft = draftOfScheme({
      bands: [
        { label: "Baik", minimum: 80 },
        { label: "Cukup", minimum: 60 },
      ],
      kktp: 75,
    });
    expect(draft).toEqual({
      bands: [
        { key: "band-0", label: "Cukup", minimum: 60 },
        { key: "band-1", label: "Baik", minimum: 80 },
      ],
      kktp: 75,
    });
    expect(checkedScheme(draft)).toEqual(
      Option.some({
        bands: [
          { label: "Cukup", minimum: 60 },
          { label: "Baik", minimum: 80 },
        ],
        kktp: 75,
      })
    );
  });

  it("trims a band's label, sorts the bands, and names no scheme while a field holds what the server refuses", () => {
    expect(
      checkedScheme({
        bands: [
          { key: "a", label: " A ", minimum: 90 },
          { key: "b", label: "B", minimum: 70 },
        ],
        kktp: 70,
      })
    ).toEqual(
      Option.some({
        bands: [
          { label: "B", minimum: 70 },
          { label: "A", minimum: 90 },
        ],
        kktp: 70,
      })
    );
    expect(checkedScheme({ bands: [], kktp: null })).toEqual(Option.none());
    expect(checkedScheme({ bands: [], kktp: 120 })).toEqual(Option.none());
    expect(
      checkedScheme({ bands: [{ key: "a", label: "", minimum: 50 }], kktp: 70 })
    ).toEqual(Option.none());
    expect(
      checkedScheme({
        bands: [{ key: "a", label: "A", minimum: null }],
        kktp: 70,
      })
    ).toEqual(Option.none());
  });

  it("dates a new version now, or just after a newest version dated later", () => {
    expect(nextEffectiveFrom(5000, Option.none())).toBe(5000);
    expect(nextEffectiveFrom(5000, Option.some(version("v-1", 1000)))).toBe(
      5000
    );
    expect(nextEffectiveFrom(5000, Option.some(version("v-2", 9000)))).toBe(
      9001
    );
  });

  it("lists a stored version at once, first on the school's first page only", () => {
    const local = createLocalStore();
    local.seed(
      records.schemes.list,
      { paginationOpts: paging, slug },
      pageOf([version("v-1", 1000)])
    );
    local.seed(
      records.schemes.list,
      { paginationOpts: later, slug },
      pageOf([version("v-0", 500)])
    );
    local.seed(
      records.schemes.list,
      { paginationOpts: paging, slug: otherSlug },
      pageOf([version("v-9", 700)])
    );
    local.seed(
      records.schemes.list,
      { paginationOpts: { cursor: null, numItems: 50 }, slug },
      undefined
    );
    storeSchemeChange(local.store, {
      bands: [{ label: "A", minimum: 90 }],
      effectiveFrom: 2000,
      kktp: 80,
      slug,
    });
    const first = Option.getOrThrow(
      local.store.getQuery(records.schemes.list, {
        paginationOpts: paging,
        slug,
      })
    );
    expect(
      Arr.map(first.page, (row) => [row.effectiveFrom, isDraft(row.id)])
    ).toEqual([
      [2000, true],
      [1000, false],
    ]);
    const second = Option.getOrThrow(
      local.store.getQuery(records.schemes.list, {
        paginationOpts: later,
        slug,
      })
    );
    expect(second.page).toHaveLength(1);
    const other = Option.getOrThrow(
      local.store.getQuery(records.schemes.list, {
        paginationOpts: paging,
        slug: otherSlug,
      })
    );
    expect(other.page).toHaveLength(1);
  });
});
