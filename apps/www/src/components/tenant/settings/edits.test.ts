import { describe, expect, it } from "@effect/vitest";
import access from "@repo/backend/confect/_generated/refs/access";
import integrations from "@repo/backend/confect/_generated/refs/integrations";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { Array as Arr, Option, Schema } from "effect";
import {
  changeGrantRoleChange,
  readdressInviteChange,
  setLocaleChange,
  updateClientChange,
} from "@/components/tenant/settings/edits";
import { createLocalStore } from "@/test/optimistic";
import {
  client,
  grant,
  invite,
  pageOf,
  paging,
  slug,
  viewer,
} from "@/test/settings";

describe("components/tenant/settings/edits", () => {
  it("shows the new country and currency of the school at once", () => {
    const local = createLocalStore();
    local.seed(tenancy.viewer.get, { slug }, viewer());
    setLocaleChange(local.store, { country: "SG", currency: "SGD", slug });
    const shown = Option.getOrThrow(
      local.store.getQuery(tenancy.viewer.get, { slug })
    );
    expect(shown.tenant).toMatchObject({ country: "SG", currency: "SGD" });
  });

  it("shows an invite's corrected address, and no other invite's", () => {
    const local = createLocalStore();
    const first = invite("first");
    const second = invite("second");
    local.seed(
      tenancy.invites.list,
      { paginationOpts: paging, slug },
      { continueCursor: "next", isDone: true, page: [first, second] }
    );
    const email = Schema.decodeSync(Email)("benar@harapan.example.test");
    readdressInviteChange(local.store, {
      email,
      inviteId: first.id,
      locale: "id",
      slug,
    });
    const shown = Option.getOrThrow(
      local.store.getQuery(tenancy.invites.list, {
        paginationOpts: paging,
        slug,
      })
    );
    expect(Arr.map(shown.page, (item) => item.email)).toEqual([
      email,
      second.email,
    ]);
  });

  it("shows a client's new name and actions, and no other client's", () => {
    const local = createLocalStore();
    const first = client("first");
    const second = client("second");
    local.seed(
      integrations.clients.list,
      { paginationOpts: paging, slug },
      { continueCursor: "next", isDone: true, page: [first, second] }
    );
    updateClientChange(local.store, {
      actions: ["person.view"],
      clientId: first.id,
      name: "Sinkron Dapodik",
      slug,
    });
    const shown = Option.getOrThrow(
      local.store.getQuery(integrations.clients.list, {
        paginationOpts: paging,
        slug,
      })
    );
    expect(Arr.map(shown.page, (item) => item.name)).toEqual([
      "Sinkron Dapodik",
      second.name,
    ]);
    expect(shown.page[0]?.actions).toEqual(["person.view"]);
  });

  it("shows a grant's new role at once, and no other grant's", () => {
    const local = createLocalStore();
    const first = grant("first");
    const second = grant("second", "staff");
    local.seed(
      access.grants.list,
      { paginationOpts: paging, slug },
      pageOf([first, second])
    );
    changeGrantRoleChange(local.store, {
      grantId: first.id,
      role: "counselor",
      slug,
    });
    const shown = Option.getOrThrow(
      local.store.getQuery(access.grants.list, {
        paginationOpts: paging,
        slug,
      })
    );
    expect(Arr.map(shown.page, (item) => item.role.key)).toEqual([
      "counselor",
      "staff",
    ]);
  });
});
