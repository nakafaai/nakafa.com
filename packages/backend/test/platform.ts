import { layerSecureRandom } from "@effect/platform-node/NodeCrypto";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { FetchClient } from "@repo/utilities/http/client";
import { Layer } from "effect";

/**
 * The Node platform that the acceptance and Nina command lines run on: Node's
 * services, its secure random source, which `NodeServices` does not carry, and
 * the fetch client that reaches a local backend.
 */
export const nodePlatform = Layer.mergeAll(
  nodeServicesLayer,
  layerSecureRandom,
  FetchClient
);
