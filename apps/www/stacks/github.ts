import {
  ApiToken,
  CloudflareEnvironment,
  providers as cloudflareProviders,
  state as cloudflareState,
} from "@alchemy.run/cloudflare";
import {
  Environment,
  providers as githubProviders,
  Secret,
  Variable,
} from "@alchemy.run/github";
import { Stack } from "alchemy";
import {
  Config,
  ConfigProvider,
  Effect,
  FileSystem,
  Layer,
  Record as Rec,
  Redacted,
  Schema,
} from "effect";
import {
  EnvironmentValuesSchema,
  isPublicName,
  setValues,
} from "#www/deploy/environment";

/**
 * The GitHub stack. The operator deploys it once from a local shell. It creates
 * the two GitHub environments, production and staging, and writes each one's
 * values from its own operator file, so staging never receives a production value.
 * The deploy workflow loads the values of the environment it deploys.
 */

const REPOSITORY = { owner: "nakafaai", repository: "nakafa.com" } as const;

/** The repository secret of the Cloudflare account, which the deploy workflow reads. */
const CLOUDFLARE_ACCOUNT_SECRET = "CLOUDFLARE_ACCOUNT_ID";

/**
 * The GitHub environments. Production deploys only from `main`. Each environment
 * reads its values from one operator file, a JSON object of names and text values
 * that stays on the operator's machine (see .gitignore).
 */
/** The operator file of each environment. The values in it are the only source of that environment's values. */
const PRODUCTION_VALUES = "apps/www/.operator/github-production.json";
const STAGING_VALUES = "apps/www/.operator/github-staging.json";

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

/** Reads one environment's operator file, which holds only the values the operator set. */
const readEnvironmentValues = Effect.fn("GitHubStack.readEnvironmentValues")(
  function* (file: string) {
    const fileSystem = yield* FileSystem.FileSystem;
    const text = yield* fileSystem.readFileString(file).pipe(
      Effect.mapError(
        (cause) =>
          new Config.ConfigError(
            new ConfigProvider.SourceError({
              cause,
              message: `Unable to read the operator values in ${file}.`,
            })
          )
      )
    );
    const values = yield* Schema.decodeEffect(EnvironmentValuesSchema)(
      text
    ).pipe(Effect.mapError((cause) => new Config.ConfigError(cause)));
    return setValues(values);
  }
);

/** Writes one environment's values as its secrets and its variables, from that environment's own operator file. */
const writeEnvironmentValues = Effect.fn("GitHubStack.writeEnvironmentValues")(
  function* (environment: Environment, file: string) {
    const values = yield* readEnvironmentValues(file);
    for (const [name, value] of Rec.toEntries(values)) {
      if (isPublicName(name)) {
        yield* Variable(`${environment.name}-${name}`, {
          ...REPOSITORY,
          environment,
          name,
          value,
        });
      } else {
        yield* Secret(`${environment.name}-${name}`, {
          ...REPOSITORY,
          environment,
          name,
          value: Redacted.make(value),
        });
      }
    }
  }
);

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

    const production = yield* Environment("production", {
      ...REPOSITORY,
      name: "production",
      deploymentBranchPolicy: { customBranchPolicies: ["main"] },
    });
    yield* writeEnvironmentValues(production, PRODUCTION_VALUES);

    const staging = yield* Environment("staging", {
      ...REPOSITORY,
      name: "staging",
    });
    yield* writeEnvironmentValues(staging, STAGING_VALUES);
  })
);
