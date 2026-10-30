import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/** The most push subscriptions one account keeps: one for each browser it signed in with, the oldest dropped first. */
export const SUBSCRIPTION_LIMIT = 10;

/** A Base64Url key of a push subscription, as a browser gives it. */
const PushKey = Schema.String.check(
  Schema.isPattern(/^[A-Za-z0-9_-]+$/u),
  Schema.isMaxLength(256)
);

/** The endpoint of a push service: an HTTPS address. */
export const PushEndpoint = Schema.String.check(
  Schema.isPattern(/^https:\/\/\S+$/u),
  Schema.isMaxLength(2048)
);

/** What a browser gives when it subscribes: the push service's endpoint and its two keys. */
export const SubscriptionKeys = {
  auth: PushKey,
  endpoint: PushEndpoint,
  p256dh: PushKey,
};

/**
 * One browser's push subscription for one account (ADR 0027). The endpoint is
 * unique: a browser that subscribes again moves its subscription to the account
 * that subscribed last.
 */
export const subscriptionValidator = Schema.Struct({
  ...SubscriptionKeys,
  createdAt: Schema.Finite,
  userId: Id("users"),
});
