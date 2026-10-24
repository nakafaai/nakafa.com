import { describe, expect, it } from "@effect/vitest";
import {
  requestKey,
  selectionKey,
} from "@/components/tryout/catalog/table/keys";
import type { TryoutSetListArgs } from "@/components/tryout/catalog/table/types";

const args: TryoutSetListArgs = {
  countryKey: "id",
  examKey: "utbk",
  filter: "all",
  locale: "id",
  paginationOpts: { cursor: null, numItems: 25 },
  sort: { direction: "asc", field: "order" },
  trackKey: "saintek",
};

describe("try-out set list keys", () => {
  it("identifies a selection by its filter and sort, not by its window", () => {
    const { paginationOpts: _window, ...selection } = args;
    expect(selectionKey(selection)).toBe(selectionKey(args));
    expect(selectionKey({ ...selection, filter: "expired" })).not.toBe(
      selectionKey(args)
    );
  });

  it("keeps the selections of two tracks apart, even with the same filter and sort", () => {
    const { paginationOpts: _window, ...selection } = args;
    expect(selectionKey({ ...selection, trackKey: "soshum" })).not.toBe(
      selectionKey(args)
    );
    expect(selectionKey({ ...selection, locale: "en" })).not.toBe(
      selectionKey(args)
    );
  });

  it("identifies a request by its selection and its window", () => {
    expect(requestKey(args)).not.toBe(
      requestKey({ ...args, paginationOpts: { cursor: null, numItems: 50 } })
    );
    expect(requestKey(args)).toBe(requestKey({ ...args }));
  });
});
