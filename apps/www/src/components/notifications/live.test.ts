// @vitest-environment node

import { PaginatedQueryResult } from "@confect/react";
import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { inboxView } from "@/components/notifications/live";

const loadingFirstPage = PaginatedQueryResult.loadingFirstPage({
  skipped: false,
});

describe("inbox view", () => {
  it("shows the server's first page while the live inbox loads its first page, and takes no change yet", () => {
    const view = inboxView(
      loadingFirstPage,
      Option.some({ isDone: false, page: ["server"] })
    );
    expect(view).toStrictEqual({
      empty: false,
      failed: false,
      ready: false,
      rows: ["server"],
    });
  });

  it("shows the empty sentence from a server page that is the whole, empty inbox", () => {
    const view = inboxView(
      loadingFirstPage,
      Option.some({ isDone: true, page: [] })
    );
    expect(view.empty).toBe(true);
    expect(view.ready).toBe(false);
  });

  it("holds no rows and no sentence while the live inbox loads without a server page", () => {
    expect(inboxView(loadingFirstPage, Option.none())).toStrictEqual({
      empty: false,
      failed: false,
      ready: false,
      rows: [],
    });
  });

  it("does not call a server page with no rows empty while it is not done", () => {
    const view = inboxView(
      loadingFirstPage,
      Option.some({ isDone: false, page: [] })
    );
    expect(view.empty).toBe(false);
  });

  it("shows the live rows once the live inbox holds its first page", () => {
    const view = inboxView(
      PaginatedQueryResult.exhausted({ results: ["live"] }),
      Option.some({ isDone: true, page: ["server"] })
    );
    expect(view).toStrictEqual({
      empty: false,
      failed: false,
      ready: true,
      rows: ["live"],
    });
  });

  it("says empty once the live inbox holds no rows at all", () => {
    const view = inboxView(
      PaginatedQueryResult.exhausted({ results: [] }),
      Option.none()
    );
    expect(view.empty).toBe(true);
    expect(view.ready).toBe(true);
  });

  it("keeps the rows a later page loaded under a failure, and stays ready for a change", () => {
    const view = inboxView(
      PaginatedQueryResult.failure({
        error: new Error("offline"),
        results: ["loaded"],
      }),
      Option.some({ isDone: false, page: ["server"] })
    );
    expect(view).toStrictEqual({
      empty: false,
      failed: true,
      ready: true,
      rows: ["loaded"],
    });
  });

  it("shows the server's page under a first page that failed, and takes no change", () => {
    const view = inboxView(
      PaginatedQueryResult.failure({
        error: new Error("offline"),
        results: [],
      }),
      Option.some({ isDone: false, page: ["server"] })
    );
    expect(view).toStrictEqual({
      empty: false,
      failed: true,
      ready: false,
      rows: ["server"],
    });
  });

  it("shows a failed first page with no rows when the server read no page", () => {
    const view = inboxView(
      PaginatedQueryResult.failure({
        error: new Error("offline"),
        results: [],
      }),
      Option.none()
    );
    expect(view).toStrictEqual({
      empty: false,
      failed: true,
      ready: false,
      rows: [],
    });
  });
});
