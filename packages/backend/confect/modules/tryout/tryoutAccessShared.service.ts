import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { TryoutProduct } from "@repo/backend/confect/modules/tryout/products";
import { TryoutAccessError } from "@repo/backend/confect/modules/tryout/tryoutAccess.errors";
import { Effect, Option } from "effect";

const DAY_IN_MS = 24 * 60 * 60 * 1e3;

/** Normalizes user-facing event access codes. */
export function normalizeTryoutAccessCode(value: string) {
  return value.trim().toLowerCase();
}

/** Lists products attached to one access campaign. */
export const listTryoutAccessCampaignProducts = Effect.fn(
  "tryoutAccess.listCampaignProducts"
)(function* (campaignId: Id<"tryoutAccessCampaigns">) {
  const reader = yield* DatabaseReader;
  const rows = yield* reader
    .table("tryoutAccessCampaignProducts")
    .index("by_campaignId", (query) => query.eq("campaignId", campaignId))
    .collect();

  return rows.map((row) => row.product);
});

/** Loads a full event access bundle by code. */
export const getTryoutAccessEventByCode = Effect.fn(
  "tryoutAccess.getEventByCode"
)(function* (code: string) {
  const reader = yield* DatabaseReader;
  const normalizedCode = normalizeTryoutAccessCode(code);

  if (normalizedCode.length === 0) {
    return null;
  }

  const link = yield* reader
    .table("tryoutAccessLinks")
    .index("by_code", (query) => query.eq("code", normalizedCode))
    .first()
    .pipe(Effect.map(Option.getOrNull));

  if (!link) {
    return null;
  }

  const campaign = yield* reader
    .table("tryoutAccessCampaigns")
    .get(link.campaignId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!campaign) {
    return null;
  }

  const products = yield* listTryoutAccessCampaignProducts(campaign._id);
  return { campaign, link, products };
});

/** Computes the current campaign redeem status for a point in time. */
export function getTryoutAccessCampaignRedeemStatus(
  campaign:
    | Doc<"tryoutAccessCampaigns">
    | { readonly startsAt: number; readonly endsAt: number },
  now: number
): "active" | "ended" | "scheduled" {
  if (campaign.startsAt > now) {
    return "scheduled";
  }

  if (campaign.endsAt <= now) {
    return "ended";
  }

  return "active";
}

/** Computes when a grant should stop being active. */
export const getTryoutAccessGrantEndsAt = Effect.fn(
  "tryoutAccess.getGrantEndsAt"
)(function* (args: {
  readonly campaign: Doc<"tryoutAccessCampaigns">;
  readonly redeemedAt: number;
}) {
  if (args.campaign.campaignKind === "competition") {
    return args.campaign.endsAt;
  }

  if (args.campaign.grantDurationDays !== undefined) {
    return args.redeemedAt + args.campaign.grantDurationDays * DAY_IN_MS;
  }

  return yield* Effect.fail(
    new TryoutAccessError({
      code: "INVALID_CAMPAIGN_WINDOW",
      message: "Access-pass campaigns must define grantDurationDays.",
    })
  );
});

/** Computes grant status for a point in time. */
export function getTryoutAccessGrantStatus(endsAt: number, now: number) {
  if (endsAt <= now) {
    return "expired";
  }

  return "active";
}

/** Explains why an event page is not redeemable. */
export function getTryoutAccessUnavailableReason(eventAccess: {
  readonly campaign: Doc<"tryoutAccessCampaigns">;
  readonly link: Doc<"tryoutAccessLinks">;
}) {
  if (!(eventAccess.link.enabled && eventAccess.campaign.enabled)) {
    return "disabled";
  }

  if (eventAccess.campaign.redeemStatus === "scheduled") {
    return "not-started";
  }

  if (eventAccess.campaign.redeemStatus === "ended") {
    return "ended";
  }

  return null;
}

/** Returns sorted unique campaign products. */
export function getUniqueCampaignProducts(
  targetProducts: readonly TryoutProduct[]
) {
  return [...new Set(targetProducts)].sort();
}

/** Checks whether two product lists are identical. */
export function haveSameCampaignProducts(args: {
  readonly existingProducts: readonly TryoutProduct[];
  readonly nextTargetProducts: readonly TryoutProduct[];
}) {
  if (args.existingProducts.length !== args.nextTargetProducts.length) {
    return false;
  }

  return args.existingProducts.every(
    (product, index) => args.nextTargetProducts[index] === product
  );
}

/** Synchronizes campaign product rows to match the setup input. */
export const syncTryoutAccessCampaignProducts = Effect.fn(
  "tryoutAccess.syncCampaignProducts"
)(function* (args: {
  readonly campaignId: Id<"tryoutAccessCampaigns">;
  readonly campaignKind: "access-pass" | "competition";
  readonly endsAt: number;
  readonly startsAt: number;
  readonly targetProducts: readonly TryoutProduct[];
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const existingRows = yield* reader
    .table("tryoutAccessCampaignProducts")
    .index("by_campaignId", (query) => query.eq("campaignId", args.campaignId))
    .collect();
  const rowsByProduct = new Map<
    TryoutProduct,
    Doc<"tryoutAccessCampaignProducts">[]
  >();

  for (const row of existingRows) {
    const rowsForProduct = rowsByProduct.get(row.product) ?? [];
    rowsForProduct.push(row);
    rowsByProduct.set(row.product, rowsForProduct);
  }

  for (const product of args.targetProducts) {
    const existingRowsForProduct = rowsByProduct.get(product) ?? [];
    const currentRow = existingRowsForProduct[0] ?? null;

    for (const duplicateRow of existingRowsForProduct.slice(1)) {
      yield* writer
        .table("tryoutAccessCampaignProducts")
        .delete(duplicateRow._id);
    }

    rowsByProduct.delete(product);

    if (!currentRow) {
      yield* writer.table("tryoutAccessCampaignProducts").insert({
        campaignId: args.campaignId,
        campaignKind: args.campaignKind,
        endsAt: args.endsAt,
        product,
        startsAt: args.startsAt,
      });
      continue;
    }

    if (
      currentRow.campaignKind === args.campaignKind &&
      currentRow.startsAt === args.startsAt &&
      currentRow.endsAt === args.endsAt
    ) {
      continue;
    }

    yield* writer.table("tryoutAccessCampaignProducts").patch(currentRow._id, {
      campaignKind: args.campaignKind,
      endsAt: args.endsAt,
      startsAt: args.startsAt,
    });
  }

  for (const staleRows of rowsByProduct.values()) {
    for (const staleRow of staleRows) {
      yield* writer.table("tryoutAccessCampaignProducts").delete(staleRow._id);
    }
  }
});
