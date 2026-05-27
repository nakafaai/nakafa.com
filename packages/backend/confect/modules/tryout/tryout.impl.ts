import { irtLayer } from "@repo/backend/confect/modules/tryout/irt/irt.impl";
import { tryoutAccessLayer } from "@repo/backend/confect/modules/tryout/tryoutAccess/tryoutAccess.impl";
import { tryoutsLayer } from "@repo/backend/confect/modules/tryout/tryouts/tryouts.impl";
import { Layer } from "effect";

export const tryoutLayer = Layer.mergeAll(
  irtLayer,
  tryoutsLayer,
  tryoutAccessLayer
);
