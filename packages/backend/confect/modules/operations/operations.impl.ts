import { Layer } from "effect";
import { triggersLayer } from "./triggers/triggers.impl";

export const operationsLayer = Layer.mergeAll(triggersLayer);
