import "@tanstack/react-start/server-only";
import { FetchClient } from "@repo/utilities/http/client";
import { Config, Layer, ManagedRuntime } from "effect";

/**
 * The address of the Convex deployment, read by server code at runtime. The
 * browser reads the same public name through `import.meta.env`, so the key keeps
 * the `VITE_` prefix in both places.
 */
export const CONVEX_URL = Config.NonEmptyString("VITE_CONVEX_URL");

/** The address of the Convex site, which serves Better Auth and its token routes. */
export const CONVEX_SITE_URL = Config.NonEmptyString("VITE_CONVEX_SITE_URL");

/**
 * The services that server code provides: outbound `fetch` only. The Confect
 * client is not shared, because a Convex HTTP client holds per-request auth state.
 * Each effect that calls Convex provides `httpLayer({ auth })` itself, so a call
 * site never reads an unauthenticated client by accident.
 */
const ServerLayer = FetchClient;

/** The services that a server effect may require, which the runtime provides. */
export type ServerServices = Layer.Success<typeof ServerLayer>;

/**
 * The memo map that the runtime shares, so each layer is built once per process
 * however many entry points run.
 */
const memoMap = Layer.makeMemoMapUnsafe();

/**
 * The one runtime of the server. Server functions, loaders and the request
 * middleware run their effects here, at the framework boundary.
 */
export const runtime = ManagedRuntime.make(ServerLayer, { memoMap });
