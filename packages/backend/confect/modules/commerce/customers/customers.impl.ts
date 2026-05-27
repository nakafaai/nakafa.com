import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import * as commerce_customer_actions from "@repo/backend/confect/modules/commerce/customers.actions";
import * as commerce_customers from "@repo/backend/confect/modules/commerce/customers.service";
import { Effect, Layer } from "effect";

const customers_queries_internal_maintenance_listUsersForCustomerIntegrityImpl =
  FunctionImpl.make(
    api,
    "customers.queries.internalFunctions.maintenance",
    "listUsersForCustomerIntegrity",
    (args) => commerce_customers.listUsersForCustomerIntegrity(args)
  );

const customers_queries_internal_maintenance_listCustomersForIntegrityImpl =
  FunctionImpl.make(
    api,
    "customers.queries.internalFunctions.maintenance",
    "listCustomersForIntegrity",
    (args) => commerce_customers.listCustomersForIntegrity(args)
  );

const customers_queries_internal_maintenance_listActiveSubscriptionsForIntegrityImpl =
  FunctionImpl.make(
    api,
    "customers.queries.internalFunctions.maintenance",
    "listActiveSubscriptionsForIntegrity",
    (args) => commerce_customers.listActiveSubscriptionsForIntegrity(args)
  );

const customers_actions_internal_syncCustomerImpl = FunctionImpl.make(
  api,
  "customers.actions.internalFunctions",
  "syncCustomer",
  (args) =>
    commerce_customer_actions.syncCustomer(args).pipe(
      Effect.catchTags({
        PolarCustomerError: (error) => Effect.die(error),
        PolarEnvironmentError: (error) => Effect.die(error),
      })
    )
);

const customers_actions_internal_repairCustomerImpl = FunctionImpl.make(
  api,
  "customers.actions.internalFunctions",
  "repairCustomer",
  (args) =>
    commerce_customer_actions.repairCustomer(args).pipe(
      Effect.catchTags({
        CustomerActionError: (error) => Effect.die(error),
        PolarCustomerError: (error) => Effect.die(error),
        PolarEnvironmentError: (error) => Effect.die(error),
      })
    )
);

const customers_actions_internal_cleanupUserDataImpl = FunctionImpl.make(
  api,
  "customers.actions.internalFunctions",
  "cleanupUserData",
  (args) =>
    commerce_customer_actions.cleanupUserData(args).pipe(
      Effect.catchTags({
        PolarCustomerError: (error) => Effect.die(error),
        PolarEnvironmentError: (error) => Effect.die(error),
      })
    )
);

const customers_actions_internal_cleanupStalePolarCustomerImpl =
  FunctionImpl.make(
    api,
    "customers.actions.internalFunctions",
    "cleanupStalePolarCustomer",
    (args) =>
      commerce_customer_actions.cleanupStalePolarCustomer(args).pipe(
        Effect.catchTags({
          CustomerActionError: (error) => Effect.die(error),
          PolarCustomerError: (error) => Effect.die(error),
          PolarEnvironmentError: (error) => Effect.die(error),
        })
      )
  );

const customers_actions_public_generateCheckoutLinkImpl = FunctionImpl.make(
  api,
  "customers.actions.publicFunctions",
  "generateCheckoutLink",
  (args) =>
    commerce_customer_actions.generateCheckoutLink(args).pipe(
      Effect.catchTags({
        CustomerActionError: (error) => Effect.die(error),
        PolarCustomerError: (error) => Effect.die(error),
        PolarEnvironmentError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const customers_actions_public_generateCustomerPortalUrlImpl =
  FunctionImpl.make(
    api,
    "customers.actions.publicFunctions",
    "generateCustomerPortalUrl",
    (_args) =>
      commerce_customer_actions.generateCustomerPortalUrl().pipe(
        Effect.catchTags({
          CustomerActionError: (error) => Effect.die(error),
          PolarCustomerError: (error) => Effect.die(error),
          PolarEnvironmentError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        })
      )
  );

const customers_mutations_internal_deleteCustomerByIdImpl = FunctionImpl.make(
  api,
  "customers.mutations.internalFunctions",
  "deleteCustomerById",
  (args) => commerce_customers.deleteCustomerById(args)
);

const customers_mutations_internal_upsertCustomerImpl = FunctionImpl.make(
  api,
  "customers.mutations.internalFunctions",
  "upsertCustomer",
  (args) => commerce_customers.upsertCustomer(args)
);

const customers_queries_internal_customer_getCustomerByUserIdImpl =
  FunctionImpl.make(
    api,
    "customers.queries.internalFunctions.customer",
    "getCustomerByUserId",
    (args) => commerce_customers.getCustomerByUserId(args)
  );

const customers_queries_internal_customer_getCustomerByPolarIdImpl =
  FunctionImpl.make(
    api,
    "customers.queries.internalFunctions.customer",
    "getCustomerByPolarId",
    (args) => commerce_customers.getCustomerByPolarId(args)
  );

const customers_queries_internal_customer_hasActiveSubscriptionByCustomerIdImpl =
  FunctionImpl.make(
    api,
    "customers.queries.internalFunctions.customer",
    "hasActiveSubscriptionByCustomerId",
    (args) => commerce_customers.hasActiveSubscriptionByCustomerId(args)
  );

const customers_queries_internal_customer_getUserIdByPolarCustomerImpl =
  FunctionImpl.make(
    api,
    "customers.queries.internalFunctions.customer",
    "getUserIdByPolarCustomer",
    (args) => commerce_customers.getUserIdByPolarCustomer(args)
  );

const customersQueriesInternalCustomerImpl = GroupImpl.make(
  api,
  "customers.queries.internalFunctions.customer"
)
  .pipe(
    Layer.provide(customers_queries_internal_customer_getCustomerByUserIdImpl)
  )
  .pipe(
    Layer.provide(customers_queries_internal_customer_getCustomerByPolarIdImpl)
  )
  .pipe(
    Layer.provide(
      customers_queries_internal_customer_hasActiveSubscriptionByCustomerIdImpl
    )
  )
  .pipe(
    Layer.provide(
      customers_queries_internal_customer_getUserIdByPolarCustomerImpl
    )
  );

const customersQueriesInternalMaintenanceImpl = GroupImpl.make(
  api,
  "customers.queries.internalFunctions.maintenance"
)
  .pipe(
    Layer.provide(
      customers_queries_internal_maintenance_listUsersForCustomerIntegrityImpl
    )
  )
  .pipe(
    Layer.provide(
      customers_queries_internal_maintenance_listCustomersForIntegrityImpl
    )
  )
  .pipe(
    Layer.provide(
      customers_queries_internal_maintenance_listActiveSubscriptionsForIntegrityImpl
    )
  );

const customersActionsInternalImpl = GroupImpl.make(
  api,
  "customers.actions.internalFunctions"
)
  .pipe(Layer.provide(customers_actions_internal_syncCustomerImpl))
  .pipe(Layer.provide(customers_actions_internal_repairCustomerImpl))
  .pipe(Layer.provide(customers_actions_internal_cleanupUserDataImpl))
  .pipe(
    Layer.provide(customers_actions_internal_cleanupStalePolarCustomerImpl)
  );

const customersActionsPublicImpl = GroupImpl.make(
  api,
  "customers.actions.publicFunctions"
)
  .pipe(Layer.provide(customers_actions_public_generateCheckoutLinkImpl))
  .pipe(Layer.provide(customers_actions_public_generateCustomerPortalUrlImpl));

const customersMutationsInternalImpl = GroupImpl.make(
  api,
  "customers.mutations.internalFunctions"
)
  .pipe(Layer.provide(customers_mutations_internal_deleteCustomerByIdImpl))
  .pipe(Layer.provide(customers_mutations_internal_upsertCustomerImpl));

const customersQueriesInternalImpl = GroupImpl.make(
  api,
  "customers.queries.internalFunctions"
)
  .pipe(Layer.provide(customersQueriesInternalCustomerImpl))
  .pipe(Layer.provide(customersQueriesInternalMaintenanceImpl));

const customersActionsImpl = GroupImpl.make(api, "customers.actions")
  .pipe(Layer.provide(customersActionsInternalImpl))
  .pipe(Layer.provide(customersActionsPublicImpl));

const customersMutationsImpl = GroupImpl.make(api, "customers.mutations").pipe(
  Layer.provide(customersMutationsInternalImpl)
);

const customersQueriesImpl = GroupImpl.make(api, "customers.queries").pipe(
  Layer.provide(customersQueriesInternalImpl)
);

const customersImpl = GroupImpl.make(api, "customers")
  .pipe(Layer.provide(customersActionsImpl))
  .pipe(Layer.provide(customersMutationsImpl))
  .pipe(Layer.provide(customersQueriesImpl));

export const customersLayer = Layer.mergeAll(customersImpl);
