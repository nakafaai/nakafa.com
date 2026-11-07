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
import { sha256Hex } from "@repo/utilities/digest";
import { PRODUCTION_DEPLOY_STAGE } from "@repo/utilities/stage";
import { Stack } from "alchemy";
import { map as mapOutput, mapEffect as mapOutputEffect } from "alchemy/Output";
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
import { filesBucketName } from "#www/deploy/files";

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
 * that stays on the operator's machine (see .gitignore). The paths are relative to apps/www, where the stack runs.
 */
/** The operator file of each environment. The values in it are the only source of that environment's values. */
const PRODUCTION_VALUES = ".operator/github-production.json";
const STAGING_VALUES = ".operator/github-staging.json";

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
 * R2 for each stage's file bucket, and Access for the staging policy.
 */
const ACCOUNT_PERMISSION_GROUPS = [
  "Workers Scripts Write",
  "Workers R2 Storage Write",
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

/**
 * Writes one environment's values as its secrets and its variables, from that environment's own operator file. The
 * logical IDs start with the environment's name as the stack declares it, because the resource's own name is an
 * Output that is unknown while the stack plans.
 */
const writeEnvironmentValues = Effect.fn("GitHubStack.writeEnvironmentValues")(
  function* (key: string, environment: Environment, file: string) {
    const values = yield* readEnvironmentValues(file);
    for (const [name, value] of Rec.toEntries(values)) {
      if (isPublicName(name)) {
        yield* Variable(`${key}-${name}`, {
          ...REPOSITORY,
          environment,
          name,
          value,
        });
      } else {
        yield* Secret(`${key}-${name}`, {
          ...REPOSITORY,
          environment,
          name,
          value: Redacted.make(value),
        });
      }
    }
  }
);

/**
 * The S3 credentials Convex signs file addresses with, for one stage's bucket alone: an account token that may read
 * and write that bucket's objects, whose ID is the access key and whose value's SHA-256 is the secret key
 * (https://developers.cloudflare.com/r2/api/tokens/). They are the environment's secrets, with the bucket's name as
 * its variable, and the deploy workflow gives all three to the stage's Convex deployment. The token can neither
 * list another bucket nor change any setting.
 */
const writeFilesCredentials = Effect.fn("GitHubStack.writeFilesCredentials")(
  function* (
    key: string,
    environment: Environment,
    accountId: string,
    stage: string
  ) {
    const bucket = filesBucketName(stage);
    const token = yield* ApiToken.AccountApiToken(`${key}-FilesToken`, {
      name: `nakafa-files-${stage}`,
      policies: [
        {
          effect: "allow",
          permissionGroups: [
            "Workers R2 Storage Bucket Item Read",
            "Workers R2 Storage Bucket Item Write",
          ],
          resources: {
            [`com.cloudflare.edge.r2.bucket.${accountId}_default_${bucket}`]:
              "*",
          },
        },
      ],
    });
    yield* Secret(`${key}-R2_ACCESS_KEY_ID`, {
      ...REPOSITORY,
      environment,
      name: "R2_ACCESS_KEY_ID",
      value: token.tokenId.pipe(mapOutput(Redacted.make)),
    });
    yield* Secret(`${key}-R2_SECRET_ACCESS_KEY`, {
      ...REPOSITORY,
      environment,
      name: "R2_SECRET_ACCESS_KEY",
      value: token.value.pipe(
        mapOutputEffect((value) =>
          sha256Hex(Redacted.value(value)).pipe(
            Effect.map(Redacted.make),
            Effect.orDie
          )
        )
      ),
    });
    yield* Variable(`${key}-R2_BUCKET`, {
      ...REPOSITORY,
      environment,
      name: "R2_BUCKET",
      value: bucket,
    });
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
    yield* writeEnvironmentValues("production", production, PRODUCTION_VALUES);
    yield* writeFilesCredentials(
      "production",
      production,
      accountId,
      PRODUCTION_DEPLOY_STAGE
    );

    const staging = yield* Environment("staging", {
      ...REPOSITORY,
      name: "staging",
    });
    yield* writeEnvironmentValues("staging", staging, STAGING_VALUES);
    yield* writeFilesCredentials("staging", staging, accountId, "staging");
  })
);
