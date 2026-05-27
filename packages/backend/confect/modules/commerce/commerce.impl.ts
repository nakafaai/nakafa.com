import { Layer } from "effect";
import { creditsLayer } from "./credits/credits.impl";
import { customersLayer } from "./customers/customers.impl";
import { subscriptionsLayer } from "./subscriptions/subscriptions.impl";

export const commerceLayer = Layer.mergeAll(
  subscriptionsLayer,
  creditsLayer,
  customersLayer
);
