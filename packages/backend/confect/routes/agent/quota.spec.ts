import { FunctionSpec, GroupSpec } from "@confect/core";
import { AgentRateLimitError } from "@repo/backend/confect/routes/agent/quota";
import { NakafaAgentDataReadError } from "@repo/contents/agent/errors";
import { Schema } from "effect";

const quotaKeyPattern = /^[0-9a-f]{64}$/;

export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "consume",
    args: () => ({
      key: Schema.String.check(Schema.isPattern(quotaKeyPattern)),
    }),
    returns: () => Schema.Null,
    error: () => Schema.Union([AgentRateLimitError, NakafaAgentDataReadError]),
  })
);
