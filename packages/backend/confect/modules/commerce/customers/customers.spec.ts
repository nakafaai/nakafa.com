import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const customersQueriesInternalMaintenanceGroup = GroupSpec.make("maintenance")
  .addFunction(
    FunctionSpec.internalQuery({
      name: "listUsersForCustomerIntegrity",
      args: Schema.Struct({
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
        page: Schema.Array(
          Schema.Struct({
            authId: Schema.String,
            email: Schema.String,
            userId: GenericId.GenericId("users"),
          })
        ),
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "listCustomersForIntegrity",
      args: Schema.Struct({
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
        page: Schema.Array(
          Schema.Struct({
            externalId: Schema.Union(Schema.String, Schema.Null),
            localCustomerId: GenericId.GenericId("customers"),
            polarCustomerId: Schema.String,
            userId: GenericId.GenericId("users"),
          })
        ),
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "listActiveSubscriptionsForIntegrity",
      args: Schema.Struct({
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
        page: Schema.Array(
          Schema.Struct({
            currentPeriodEnd: Schema.Union(Schema.String, Schema.Null),
            customerId: Schema.String,
            status: Schema.String,
            subscriptionId: Schema.String,
          })
        ),
      }),
    })
  );

export { customersQueriesInternalMaintenanceGroup };

const customersQueriesInternalCustomerGroup = GroupSpec.make("customer")
  .addFunction(
    FunctionSpec.internalQuery({
      name: "getCustomerByUserId",
      args: Schema.Struct({ userId: GenericId.GenericId("users") }),
      returns: Schema.Union(
        Schema.Null,
        Schema.Struct({
          _creationTime: Schema.Number,
          _id: GenericId.GenericId("customers"),
          externalId: Schema.Union(Schema.Null, Schema.String),
          id: Schema.String,
          metadata: Schema.optional(
            Schema.Record({
              key: Schema.String,
              value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean),
            })
          ),
          userId: GenericId.GenericId("users"),
        })
      ),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "getCustomerByPolarId",
      args: Schema.Struct({ polarCustomerId: Schema.String }),
      returns: Schema.Union(
        Schema.Null,
        Schema.Struct({
          _creationTime: Schema.Number,
          _id: GenericId.GenericId("customers"),
          externalId: Schema.Union(Schema.Null, Schema.String),
          id: Schema.String,
          metadata: Schema.optional(
            Schema.Record({
              key: Schema.String,
              value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean),
            })
          ),
          userId: GenericId.GenericId("users"),
        })
      ),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "hasActiveSubscriptionByCustomerId",
      args: Schema.Struct({ customerId: Schema.String }),
      returns: Schema.Boolean,
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "getUserIdByPolarCustomer",
      args: Schema.Struct({
        externalId: Schema.optional(Schema.String),
        metadataUserId: Schema.optional(Schema.String),
      }),
      returns: Schema.Union(Schema.Null, GenericId.GenericId("users")),
    })
  );

export { customersQueriesInternalCustomerGroup };

const customersQueriesInternalGroup = GroupSpec.make("internalFunctions")
  .addGroup(customersQueriesInternalMaintenanceGroup)
  .addGroup(customersQueriesInternalCustomerGroup);

export { customersQueriesInternalGroup };

const customersQueriesGroup = GroupSpec.make("queries").addGroup(
  customersQueriesInternalGroup
);

export { customersQueriesGroup };

const customersActionsInternalGroup = GroupSpec.make("internalFunctions")
  .addFunction(
    FunctionSpec.internalAction({
      name: "syncCustomer",
      args: Schema.Struct({ userId: GenericId.GenericId("users") }),
      returns: Schema.Union(GenericId.GenericId("customers"), Schema.Null),
    })
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "repairCustomer",
      args: Schema.Struct({ userId: GenericId.GenericId("users") }),
      returns: Schema.Union(
        Schema.Struct({
          localCustomerId: GenericId.GenericId("customers"),
          status: Schema.Literal("synced"),
        }),
        Schema.Struct({
          existingExternalId: Schema.Union(Schema.String, Schema.Null),
          polarCustomerId: Schema.String,
          status: Schema.Literal("conflict"),
        })
      ),
    })
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "cleanupUserData",
      args: Schema.Struct({ userId: GenericId.GenericId("users") }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "cleanupStalePolarCustomer",
      args: Schema.Struct({
        existingExternalId: Schema.Union(Schema.String, Schema.Null),
        polarCustomerId: Schema.String,
      }),
      returns: Schema.Null,
    })
  );

export { customersActionsInternalGroup };

const customersActionsPublicGroup = GroupSpec.make("publicFunctions")
  .addFunction(
    FunctionSpec.publicAction({
      name: "generateCheckoutLink",
      args: Schema.Struct({
        productIds: Schema.Array(Schema.String),
        successUrl: Schema.String,
      }),
      returns: Schema.Struct({ url: Schema.String }),
    })
  )
  .addFunction(
    FunctionSpec.publicAction({
      name: "generateCustomerPortalUrl",
      args: Schema.Struct({}),
      returns: Schema.Struct({ url: Schema.String }),
    })
  );

export { customersActionsPublicGroup };

const customersActionsGroup = GroupSpec.make("actions")
  .addGroup(customersActionsInternalGroup)
  .addGroup(customersActionsPublicGroup);

export { customersActionsGroup };

const customersMutationsInternalGroup = GroupSpec.make("internalFunctions")
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteCustomerById",
      args: Schema.Struct({ id: Schema.String }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "upsertCustomer",
      args: Schema.Struct({
        customer: Schema.Struct({
          externalId: Schema.Union(Schema.Null, Schema.String),
          id: Schema.String,
          metadata: Schema.optional(
            Schema.Record({
              key: Schema.String,
              value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean),
            })
          ),
          userId: GenericId.GenericId("users"),
        }),
      }),
      returns: GenericId.GenericId("customers"),
    })
  );

export { customersMutationsInternalGroup };

const customersMutationsGroup = GroupSpec.make("mutations").addGroup(
  customersMutationsInternalGroup
);

export { customersMutationsGroup };

const customersGroup = GroupSpec.make("customers")
  .addGroup(customersQueriesGroup)
  .addGroup(customersActionsGroup)
  .addGroup(customersMutationsGroup);

export { customersGroup };
