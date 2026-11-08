import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import roster from "@repo/backend/confect/_generated/refs/roster";
import { Array as Arr, Option, Schema } from "effect";
import {
  changeLoaded,
  changeRows,
  dropRows,
  findLoaded,
  withPage,
} from "@/lib/data/loaded";
import { createLocalStore } from "@/test/optimistic";
import { otherSlug, slug } from "@/test/settings";

const person = Schema.decodeUnknownSync(Id("tenantPeople"));
const ada = person("person-ada");
const ben = person("person-ben");

describe("lib/data/loaded", () => {
  it("rewrites each loaded result the change answers for, and leaves the others and a loading one unwritten", () => {
    const local = createLocalStore();
    local.seed(
      roster.entries.get,
      { personId: ada, slug },
      { hasNisn: false, personId: ada }
    );
    local.seed(
      roster.entries.get,
      { personId: ben, slug },
      { hasNisn: false, personId: ben }
    );
    local.seed(
      roster.entries.get,
      { personId: ada, slug: otherSlug },
      { hasNisn: false, personId: ada }
    );
    local.seed(
      roster.entries.get,
      { personId: ben, slug: otherSlug },
      undefined
    );

    changeLoaded(local.store, roster.entries.get, (value, args) =>
      args.slug === slug && value.personId === ada
        ? Option.some({ ...value, hasNisn: true })
        : Option.none()
    );

    expect(
      local.store.getQuery(roster.entries.get, { personId: ada, slug })
    ).toEqual(Option.some({ hasNisn: true, personId: ada }));
    expect(
      local.store.getQuery(roster.entries.get, { personId: ben, slug })
    ).toEqual(Option.some({ hasNisn: false, personId: ben }));
    expect(local.written()).toHaveLength(1);
  });

  it("hands the change the arguments its result was loaded with", () => {
    const local = createLocalStore();
    local.seed(
      roster.entries.get,
      { personId: ben, slug },
      { hasNisn: true, personId: ada }
    );

    changeLoaded(local.store, roster.entries.get, (value, args) =>
      Option.some({ ...value, personId: args.personId })
    );

    expect(
      local.store.getQuery(roster.entries.get, { personId: ben, slug })
    ).toEqual(Option.some({ hasNisn: true, personId: ben }));
  });

  it("finds the first answer among the loaded results, past a loading one and one that answers none", () => {
    const local = createLocalStore();
    local.seed(
      roster.entries.get,
      { personId: ada, slug: otherSlug },
      undefined
    );
    local.seed(
      roster.entries.get,
      { personId: ada, slug },
      { hasNisn: false, personId: ada }
    );
    local.seed(
      roster.entries.get,
      { personId: ben, slug },
      { hasNisn: true, personId: ben }
    );
    const nisnHolder = () =>
      findLoaded(local.store, roster.entries.get, (value, args) =>
        value.hasNisn ? Option.some(args.personId) : Option.none()
      );

    expect(nisnHolder()).toEqual(Option.some(ben));
    expect(
      findLoaded(local.store, roster.entries.get, () => Option.none())
    ).toEqual(Option.none());
  });

  it("changes a page's rows and keeps the rest of the page", () => {
    const page = { continueCursor: "next", isDone: false, page: [1, 2, 3] };

    expect(
      withPage(page, (rows) => Arr.filter(rows, (row) => row !== 2))
    ).toEqual({
      continueCursor: "next",
      isDone: false,
      page: [1, 3],
    });
  });

  it("changes the rows a page holds, and answers none for a page without such a row", () => {
    const page = { continueCursor: "next", isDone: false, page: [1, 2, 3] };

    expect(
      changeRows(
        page,
        (row) => row === 2,
        (row) => row * 10
      )
    ).toEqual(
      Option.some({ continueCursor: "next", isDone: false, page: [1, 20, 3] })
    );
    expect(
      changeRows(
        page,
        (row) => row === 9,
        (row) => row * 10
      )
    ).toEqual(Option.none());
  });

  it("drops the rows a page holds, and answers none for a page without such a row", () => {
    const page = { continueCursor: "next", isDone: false, page: [1, 2, 3] };

    expect(dropRows(page, (row) => row === 2)).toEqual(
      Option.some({ continueCursor: "next", isDone: false, page: [1, 3] })
    );
    expect(dropRows(page, (row) => row === 9)).toEqual(Option.none());
  });
});
