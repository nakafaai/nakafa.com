import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { tryoutAccessCampaignKindSchema } from "@repo/backend/confect/modules/tryout/access.tables";
import { tryoutProductSchema } from "@repo/backend/confect/modules/tryout/products";
import { Schema } from "effect";

const tryoutAccessMutationsSetupGroup = GroupSpec.make("setup").addFunction(
  FunctionSpec.internalMutation({
    name: "upsertCampaignAndLink",
    args: Schema.Struct({
      campaign: Schema.Struct({
        campaignKind: tryoutAccessCampaignKindSchema,
        enabled: Schema.Boolean,
        endsAt: Schema.Number,
        grantDurationDays: Schema.optional(Schema.Number),
        name: Schema.String,
        slug: Schema.String,
        startsAt: Schema.Number,
        targetProducts: Schema.Array(tryoutProductSchema),
      }),
      link: Schema.Struct({
        code: Schema.String,
        enabled: Schema.Boolean,
        label: Schema.String,
      }),
    }),
    returns: Schema.Struct({
      campaignId: GenericId.GenericId("tryoutAccessCampaigns"),
      code: Schema.String,
      linkId: GenericId.GenericId("tryoutAccessLinks"),
    }),
  })
);

export { tryoutAccessMutationsSetupGroup };

const tryoutAccessMutationsInternalStatusGroup = GroupSpec.make("status")
  .addFunction(
    FunctionSpec.internalMutation({
      name: "expireGrant",
      args: Schema.Struct({
        grantId: GenericId.GenericId("tryoutAccessGrants"),
      }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "sweepStates",
      args: Schema.Struct({}),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "syncCampaignRedeemStatus",
      args: Schema.Struct({
        campaignId: GenericId.GenericId("tryoutAccessCampaigns"),
      }),
      returns: Schema.Null,
    })
  );

export { tryoutAccessMutationsInternalStatusGroup };

const tryoutAccessMutationsInternalCompetitionGroup = GroupSpec.make(
  "competition"
).addFunction(
  FunctionSpec.internalMutation({
    name: "finalizeCompetitionCampaignResults",
    args: Schema.Struct({
      campaignId: GenericId.GenericId("tryoutAccessCampaigns"),
    }),
    returns: Schema.Null,
  })
);

export { tryoutAccessMutationsInternalCompetitionGroup };

const tryoutAccessMutationsInternalGroup = GroupSpec.make("internalFunctions")
  .addGroup(tryoutAccessMutationsInternalStatusGroup)
  .addGroup(tryoutAccessMutationsInternalCompetitionGroup);

export { tryoutAccessMutationsInternalGroup };

const tryoutAccessMutationsRedeemGroup = GroupSpec.make("redeem").addFunction(
  FunctionSpec.publicMutation({
    name: "redeemEventAccess",
    args: Schema.Struct({ code: Schema.String }),
    returns: Schema.Union(
      Schema.Struct({
        endsAt: Schema.Number,
        kind: Schema.Literal("active"),
        name: Schema.String,
      }),
      Schema.Struct({
        endsAt: Schema.Number,
        kind: Schema.Literal("already-active"),
        name: Schema.String,
      }),
      Schema.Struct({
        endsAt: Schema.Number,
        kind: Schema.Literal("used"),
        name: Schema.String,
      }),
      Schema.Struct({ kind: Schema.Literal("disabled"), name: Schema.String }),
      Schema.Struct({
        kind: Schema.Literal("not-started"),
        name: Schema.String,
      }),
      Schema.Struct({ kind: Schema.Literal("ended"), name: Schema.String }),
      Schema.Struct({ kind: Schema.Literal("not-found") })
    ),
  })
);

export { tryoutAccessMutationsRedeemGroup };

const tryoutAccessMutationsGroup = GroupSpec.make("mutations")
  .addGroup(tryoutAccessMutationsSetupGroup)
  .addGroup(tryoutAccessMutationsInternalGroup)
  .addGroup(tryoutAccessMutationsRedeemGroup);

export { tryoutAccessMutationsGroup };

const tryoutAccessQueriesInternalMaintenanceGroup = GroupSpec.make(
  "maintenance"
)
  .addFunction(
    FunctionSpec.internalQuery({
      name: "getTryoutAccessCampaignIntegrity",
      args: Schema.Struct({
        nowMs: Schema.Number,
        paginationOpts: Schema.Struct({
          cursor: Schema.Union(Schema.String, Schema.Null),
          endCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
          id: Schema.optional(Schema.Number),
          maximumBytesRead: Schema.optional(Schema.Number),
          maximumRowsRead: Schema.optional(Schema.Number),
          numItems: Schema.Number,
        }),
      }),
      returns: Schema.Struct({
        continueCursor: Schema.String,
        isDone: Schema.Boolean,
        overdueActiveCampaignCount: Schema.Number,
        overduePendingCompetitionCount: Schema.Number,
        overdueScheduledCampaignCount: Schema.Number,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "getTryoutAccessGrantIntegrity",
      args: Schema.Struct({
        nowMs: Schema.Number,
        paginationOpts: Schema.Struct({
          cursor: Schema.Union(Schema.String, Schema.Null),
          endCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
          id: Schema.optional(Schema.Number),
          maximumBytesRead: Schema.optional(Schema.Number),
          maximumRowsRead: Schema.optional(Schema.Number),
          numItems: Schema.Number,
        }),
      }),
      returns: Schema.Struct({
        continueCursor: Schema.String,
        isDone: Schema.Boolean,
        overdueActiveGrantCount: Schema.Number,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "getTryoutAccessEntitlementIntegrity",
      args: Schema.Struct({
        nowMs: Schema.Number,
        paginationOpts: Schema.Struct({
          cursor: Schema.Union(Schema.String, Schema.Null),
          endCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
          id: Schema.optional(Schema.Number),
          maximumBytesRead: Schema.optional(Schema.Number),
          maximumRowsRead: Schema.optional(Schema.Number),
          numItems: Schema.Number,
        }),
      }),
      returns: Schema.Struct({
        continueCursor: Schema.String,
        isDone: Schema.Boolean,
        overdueEntitlementCount: Schema.Number,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "listCompetitionCampaignProductsByProduct",
      args: Schema.Struct({
        paginationOpts: Schema.Struct({
          cursor: Schema.Union(Schema.String, Schema.Null),
          endCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
          id: Schema.optional(Schema.Number),
          maximumBytesRead: Schema.optional(Schema.Number),
          maximumRowsRead: Schema.optional(Schema.Number),
          numItems: Schema.Number,
        }),
        product: tryoutProductSchema,
      }),
      returns: Schema.Struct({
        continueCursor: Schema.String,
        isDone: Schema.Boolean,
        page: Schema.Array(
          Schema.Struct({
            campaignId: GenericId.GenericId("tryoutAccessCampaigns"),
            endsAt: Schema.Number,
            startsAt: Schema.Number,
          })
        ),
      }),
    })
  );

export { tryoutAccessQueriesInternalMaintenanceGroup };

const tryoutAccessQueriesInternalGroup = GroupSpec.make(
  "internalFunctions"
).addGroup(tryoutAccessQueriesInternalMaintenanceGroup);

export { tryoutAccessQueriesInternalGroup };

const tryoutAccessQueriesPageGroup = GroupSpec.make("page").addFunction(
  FunctionSpec.publicQuery({
    name: "getEventPageState",
    args: Schema.Struct({ code: Schema.String }),
    returns: Schema.Union(
      Schema.Struct({
        kind: Schema.Literal("unavailable"),
        name: Schema.Union(Schema.String, Schema.Null),
        reason: Schema.Literal(
          "invalid-code",
          "disabled",
          "not-started",
          "ended"
        ),
      }),
      Schema.Struct({ kind: Schema.Literal("sign-in"), name: Schema.String }),
      Schema.Struct({ kind: Schema.Literal("ready"), name: Schema.String }),
      Schema.Struct({
        endsAt: Schema.Number,
        kind: Schema.Literal("active"),
        name: Schema.String,
      }),
      Schema.Struct({
        endsAt: Schema.Number,
        kind: Schema.Literal("used"),
        name: Schema.String,
      })
    ),
  })
);

export { tryoutAccessQueriesPageGroup };

const tryoutAccessQueriesGroup = GroupSpec.make("queries")
  .addGroup(tryoutAccessQueriesInternalGroup)
  .addGroup(tryoutAccessQueriesPageGroup);

export { tryoutAccessQueriesGroup };

const tryoutAccessGroup = GroupSpec.make("tryoutAccess")
  .addGroup(tryoutAccessMutationsGroup)
  .addGroup(tryoutAccessQueriesGroup);

export { tryoutAccessGroup };
