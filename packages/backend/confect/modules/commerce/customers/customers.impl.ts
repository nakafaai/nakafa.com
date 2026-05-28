import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  cleanupStalePolarCustomer as commerceCustomerActions_cleanupStalePolarCustomer,
  cleanupUserData as commerceCustomerActions_cleanupUserData,
  generateCheckoutLink as commerceCustomerActions_generateCheckoutLink,
  generateCustomerPortalUrl as commerceCustomerActions_generateCustomerPortalUrl,
  repairCustomer as commerceCustomerActions_repairCustomer,
  syncCustomer as commerceCustomerActions_syncCustomer,
} from "@repo/backend/confect/modules/commerce/customers.actions";
import {
  deleteCustomerById as commerceCustomers_deleteCustomerById,
  getCustomerByPolarId as commerceCustomers_getCustomerByPolarId,
  getCustomerByUserId as commerceCustomers_getCustomerByUserId,
  getUserIdByPolarCustomer as commerceCustomers_getUserIdByPolarCustomer,
  hasActiveSubscriptionByCustomerId as commerceCustomers_hasActiveSubscriptionByCustomerId,
  listActiveSubscriptionsForIntegrity as commerceCustomers_listActiveSubscriptionsForIntegrity,
  listCustomersForIntegrity as commerceCustomers_listCustomersForIntegrity,
  listUsersForCustomerIntegrity as commerceCustomers_listUsersForCustomerIntegrity,
  upsertCustomer as commerceCustomers_upsertCustomer,
} from "@repo/backend/confect/modules/commerce/customers.service";
import { Effect, Layer } from "effect";

const customers_queries_internal_maintenance_listUsersForCustomerIntegrityImpl =
  FunctionImpl.make(
    api,
    "customers.queries.internalFunctions.maintenance",
    "listUsersForCustomerIntegrity",
    (args) =>
      commerceCustomers_listUsersForCustomerIntegrity(args).pipe(Effect.orDie)
  );

const customers_queries_internal_maintenance_listCustomersForIntegrityImpl =
  FunctionImpl.make(
    api,
    "customers.queries.internalFunctions.maintenance",
    "listCustomersForIntegrity",
    (args) =>
      commerceCustomers_listCustomersForIntegrity(args).pipe(Effect.orDie)
  );

const customers_queries_internal_maintenance_listActiveSubscriptionsForIntegrityImpl =
  FunctionImpl.make(
    api,
    "customers.queries.internalFunctions.maintenance",
    "listActiveSubscriptionsForIntegrity",
    (args) =>
      commerceCustomers_listActiveSubscriptionsForIntegrity(args).pipe(
        Effect.orDie
      )
  );

const customers_actions_internal_syncCustomerImpl = FunctionImpl.make(
  api,
  "customers.actions.internalFunctions",
  "syncCustomer",
  (args) =>
    commerceCustomerActions_syncCustomer(args).pipe(
      Effect.catchTags({
        PolarCustomerError: (error) => Effect.die(error),
        PolarEnvironmentError: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);

const customers_actions_internal_repairCustomerImpl = FunctionImpl.make(
  api,
  "customers.actions.internalFunctions",
  "repairCustomer",
  (args) =>
    commerceCustomerActions_repairCustomer(args).pipe(
      Effect.catchTags({
        CustomerActionError: (error) => Effect.die(error),
        PolarCustomerError: (error) => Effect.die(error),
        PolarEnvironmentError: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);

const customers_actions_internal_cleanupUserDataImpl = FunctionImpl.make(
  api,
  "customers.actions.internalFunctions",
  "cleanupUserData",
  (args) =>
    commerceCustomerActions_cleanupUserData(args).pipe(
      Effect.catchTags({
        PolarCustomerError: (error) => Effect.die(error),
        PolarEnvironmentError: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);

const customers_actions_internal_cleanupStalePolarCustomerImpl =
  FunctionImpl.make(
    api,
    "customers.actions.internalFunctions",
    "cleanupStalePolarCustomer",
    (args) =>
      commerceCustomerActions_cleanupStalePolarCustomer(args).pipe(
        Effect.catchTags({
          CustomerActionError: (error) => Effect.die(error),
          PolarCustomerError: (error) => Effect.die(error),
          PolarEnvironmentError: (error) => Effect.die(error),
        }),
        Effect.orDie
      )
  );

const customers_actions_public_generateCheckoutLinkImpl = FunctionImpl.make(
  api,
  "customers.actions.publicFunctions",
  "generateCheckoutLink",
  (args) =>
    commerceCustomerActions_generateCheckoutLink(args).pipe(
      Effect.catchTags({
        CustomerActionError: (error) => Effect.die(error),
        PolarCustomerError: (error) => Effect.die(error),
        PolarEnvironmentError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);

const customers_actions_public_generateCustomerPortalUrlImpl =
  FunctionImpl.make(
    api,
    "customers.actions.publicFunctions",
    "generateCustomerPortalUrl",
    (_args) =>
      commerceCustomerActions_generateCustomerPortalUrl().pipe(
        Effect.catchTags({
          CustomerActionError: (error) => Effect.die(error),
          PolarCustomerError: (error) => Effect.die(error),
          PolarEnvironmentError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        }),
        Effect.orDie
      )
  );

const customers_mutations_internal_deleteCustomerByIdImpl = FunctionImpl.make(
  api,
  "customers.mutations.internalFunctions",
  "deleteCustomerById",
  (args) => commerceCustomers_deleteCustomerById(args).pipe(Effect.orDie)
);

const customers_mutations_internal_upsertCustomerImpl = FunctionImpl.make(
  api,
  "customers.mutations.internalFunctions",
  "upsertCustomer",
  (args) => commerceCustomers_upsertCustomer(args).pipe(Effect.orDie)
);

const customers_queries_internal_customer_getCustomerByUserIdImpl =
  FunctionImpl.make(
    api,
    "customers.queries.internalFunctions.customer",
    "getCustomerByUserId",
    (args) => commerceCustomers_getCustomerByUserId(args).pipe(Effect.orDie)
  );

const customers_queries_internal_customer_getCustomerByPolarIdImpl =
  FunctionImpl.make(
    api,
    "customers.queries.internalFunctions.customer",
    "getCustomerByPolarId",
    (args) => commerceCustomers_getCustomerByPolarId(args).pipe(Effect.orDie)
  );

const customers_queries_internal_customer_hasActiveSubscriptionByCustomerIdImpl =
  FunctionImpl.make(
    api,
    "customers.queries.internalFunctions.customer",
    "hasActiveSubscriptionByCustomerId",
    (args) =>
      commerceCustomers_hasActiveSubscriptionByCustomerId(args).pipe(
        Effect.orDie
      )
  );

const customers_queries_internal_customer_getUserIdByPolarCustomerImpl =
  FunctionImpl.make(
    api,
    "customers.queries.internalFunctions.customer",
    "getUserIdByPolarCustomer",
    (args) =>
      commerceCustomers_getUserIdByPolarCustomer(args).pipe(Effect.orDie)
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
