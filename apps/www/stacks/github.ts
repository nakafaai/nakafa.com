import {
  ApiToken,
  CloudflareEnvironment,
  providers as cloudflareProviders,
  state as cloudflareState,
} from "@alchemy.run/cloudflare";
import { providers as githubProviders, Secret } from "@alchemy.run/github";
import { Stack } from "alchemy";
import { Config, Effect, Layer, Redacted } from "effect";
import { serverSecretNames } from "#www/deploy/secrets";
import { workerEnvironment } from "#www/worker";

/**
 * The GitHub stack. The operator deploys it once from a local shell that holds
 * the server values, and it writes them to the repository as Actions secrets.
 * The deploy workflow reads those secrets, so no value is written anywhere else.
 */

const REPOSITORY = { owner: "nakafaai", repository: "nakafa.com" } as const;

/** The Actions secret of the Cloudflare account, which the deploy workflow reads. */
const CLOUDFLARE_ACCOUNT_SECRET = "CLOUDFLARE_ACCOUNT_ID";

/** The Actions secret of the production Convex deploy key. */
const CONVEX_PRODUCTION_KEY = "CONVEX_DEPLOY_KEY";

/** The Actions secret of the staging Convex deploy key, which the staging deploy reads. */
const CONVEX_STAGING_KEY = "CONVEX_STAGING_DEPLOY_KEY";

/**
 * Cloudflare names both Access groups "Access: Apps and Policies Write", so each
 * one is named by its id: the account group for the account resource, and the
 * zone group for the zone resources.
 */
const ACCESS_ACCOUNT_PERMISSION = { id: "1e13c5124ca64b72b1969a67e8829049" };
const ACCESS_ZONE_PERMISSION = { id: "959972745952452f8be2452be8cbb9f2" };

/**
 * The account permissions of the deploy token: Workers scripts and the account
 * settings for the Workers subdomain, Secrets Store for the Alchemy state login,
 * and Access for the staging policy.
 */
const ACCOUNT_PERMISSION_GROUPS = [
  "Workers Scripts Write",
  "Account Settings Read",
  "Secrets Store Read",
  "Secrets Store Write",
  ACCESS_ACCOUNT_PERMISSION,
] as const;

/**
 * The zone permissions of the deploy token, for nakafa.com and nakafa.id: zone
 * reads and settings, DNS records, Worker routes, Access, and the Dynamic URL
 * Redirects that the nakafa.id rule uses.
 */
const ZONE_PERMISSION_GROUPS = [
  "Zone Read",
  "DNS Write",
  "Workers Routes Write",
  "Zone Settings Write",
  "Dynamic URL Redirects Write",
  ACCESS_ZONE_PERMISSION,
] as const;

export default Stack(
  "NakafaGitHub",
  {
    providers: Layer.mergeAll(githubProviders(), cloudflareProviders()),
    state: cloudflareState(),
  },
  Effect.gen(function* () {
    const { accountId } = yield* yield* CloudflareEnvironment;

    const token = yield* ApiToken.AccountApiToken("CloudflareDeployToken", {
      name: "nakafa-deploy",
      policies: [
        {
          effect: "allow",
          permissionGroups: [...ACCOUNT_PERMISSION_GROUPS],
          resources: { [`com.cloudflare.api.account.${accountId}`]: "*" },
        },
        {
          effect: "allow",
          permissionGroups: [...ZONE_PERMISSION_GROUPS],
          resources: {
            [`com.cloudflare.api.account.${accountId}`]: {
              "com.cloudflare.api.account.zone.*": "*",
            },
          },
        },
      ],
    });

    yield* Secret("CloudflareApiToken", {
      ...REPOSITORY,
      name: "CLOUDFLARE_API_TOKEN",
      value: token.value,
    });
    yield* Secret("CloudflareAccountId", {
      ...REPOSITORY,
      name: CLOUDFLARE_ACCOUNT_SECRET,
      value: Redacted.make(accountId),
    });

    yield* Effect.forEach(serverSecretNames(workerEnvironment()), (name) =>
      Effect.gen(function* () {
        const value = yield* Config.Redacted(name);
        return yield* Secret(`Server-${name}`, { ...REPOSITORY, name, value });
      })
    );

    yield* Secret("ConvexProductionDeployKey", {
      ...REPOSITORY,
      name: CONVEX_PRODUCTION_KEY,
      value: yield* Config.Redacted(CONVEX_PRODUCTION_KEY),
    });
    yield* Secret("ConvexStagingDeployKey", {
      ...REPOSITORY,
      name: CONVEX_STAGING_KEY,
      value: yield* Config.Redacted(CONVEX_STAGING_KEY),
    });
  })
);
