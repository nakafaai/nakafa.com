import "@tanstack/react-start/server-only";
import { HttpClient } from "@confect/js";
import { FetchClient } from "@repo/utilities/http/client";
import { Config, Effect, Layer, ManagedRuntime } from "effect";

/**
 * The address of the Convex deployment, read by server code at runtime. The
 * browser reads the same public name through `import.meta.env`, so the key keeps
 * the `VITE_` prefix in both places.
 */
export const CONVEX_URL = Config.NonEmptyString("VITE_CONVEX_URL");

/** The address of the Convex site, which serves Better Auth and its token routes. */
export const CONVEX_SITE_URL = Config.NonEmptyString("VITE_CONVEX_SITE_URL");

/**
 * The Confect client of the Convex deployment, built from its address. A
 * missing address is a configuration defect, so it stops the server instead of
 * reaching the typed failures of the handlers.
 */
const ConfectClient = Layer.orDie(
  Layer.unwrap(Effect.map(CONVEX_URL, (url) => HttpClient.layer(url)))
);

/** Every service that server code provides: outbound `fetch` and the Confect client. */
const ServerLayer = Layer.mergeAll(FetchClient, ConfectClient);

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
