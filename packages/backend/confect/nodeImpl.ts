import { Impl } from "@confect/server";
import { Layer } from "effect";
import nodeApi from "./_generated/nodeApi";
import { generated } from "./generated.nodeImpl";

export default Impl.make(nodeApi).pipe(Layer.provide(generated), Impl.finalize);
