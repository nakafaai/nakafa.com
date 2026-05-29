import { Impl } from "@confect/server";
import nodeApi from "@repo/backend/confect/_generated/nodeApi";
import { audioStudiesNodeLayer } from "@repo/backend/confect/node/audioStudies.impl";
import { Layer } from "effect";

export default Impl.make(nodeApi).pipe(
  Layer.provide(audioStudiesNodeLayer),
  Impl.finalize
);
