import { Layer } from "effect";
import { irtLayer } from "./irt/irt.impl";
import { tryoutAccessLayer } from "./tryoutAccess/tryoutAccess.impl";
import { tryoutsLayer } from "./tryouts/tryouts.impl";

export const tryoutLayer = Layer.mergeAll(
  irtLayer,
  tryoutsLayer,
  tryoutAccessLayer
);
