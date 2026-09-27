import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseErrorWire } from "@repo/backend/confect/contentRelease/error";
import {
  ContentViewIoErrorWire,
  recordContentViewArgs,
  recordContentViewResultValidator,
} from "@repo/backend/confect/contents/views/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";
export default GroupSpec.make().addFunction(
  FunctionSpec.publicMutation({
    name: "recordContentView",
    args: () => recordContentViewArgs,
    returns: () => recordContentViewResultValidator,
    error: () => Schema.Union([ContentViewIoErrorWire, ReleaseErrorWire]),
  }).middleware(Atomic)
);
