import { layerSecureRandom } from "@effect/platform-node/NodeCrypto";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { Layer } from "effect";

/**
 * The Node platform that the acceptance and Nina command lines run on: Node's
 * services and its secure random source, which `NodeServices` does not carry.
 */
export const nodePlatform = Layer.merge(nodeServicesLayer, layerSecureRandom);
