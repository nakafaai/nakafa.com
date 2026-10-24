import {
  ApiToken,
  CloudflareEnvironment,
  providers as cloudflareProviders,
  state as cloudflareState,
} from "@alchemy.run/cloudflare";
import { providers as githubProviders, Secret } from "@alchemy.run/github";
import { Stack } from "alchemy";
import { Array as Arr, Config, Effect, Layer, Record, Redacted } from "effect";
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

/**
 * The permissions that the deploy token needs: Workers scripts and routes for
 * the Workers, zone reads and DNS for the nakafa.com records, zone settings,
 * Access for the staging policy, and account settings for the Workers subdomain.
 */
const DEPLOY_PERMISSION_GROUPS = [
  "Workers Scripts Write",
  "Workers Routes Write",
  "Zone Read",
  "DNS Write",
  "Zone Settings Write",
  "Access: Apps and Policies Write",
  "Account Settings Read",
] as const;

/**
 * The server values that the Workers bind. A `VITE_` name is public and the
 * client bundle inlines it, so it is not a secret. Optional values that the
 * environment leaves unset are not written.
 */
const serverSecretNames = () =>
  Arr.dedupe([
    ...Record.keys(
      Record.filter(workerEnvironment(), (value) => value !== undefined)
    ),
    "NAKAFA_CONVEX_SITE_URL",
    "NAKAFA_API_EDGE_SECRET",
    "NAKAFA_MCP_EDGE_SECRET",
  ]).filter((name) => !name.startsWith("VITE_"));

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
          permissionGroups: [...DEPLOY_PERMISSION_GROUPS],
          resources: { [`com.cloudflare.api.account.${accountId}`]: "*" },
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

    yield* Effect.forEach(serverSecretNames(), (name) =>
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
  })
);
