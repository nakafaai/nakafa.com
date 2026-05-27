import { triggersLayer } from "@repo/backend/confect/modules/operations/triggers/triggers.impl";
import { Layer } from "effect";

export const operationsLayer = Layer.mergeAll(triggersLayer);
