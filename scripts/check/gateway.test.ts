import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { inspectGatewaySource } from "#scripts/check/gateway";
import { parseSources } from "#scripts/check/source";

const NINA = "packages/backend/confect/nina/generation.ts";
const GATEWAY = "packages/backend/confect/gateway/live.ts";
const PACKAGE =
  "never import @ai-sdk/gateway; the Convex AI gateway provider serves every model call";
const PROVIDER =
  "import @convex-dev/ai-sdk-provider only inside packages/backend/confect/gateway/; take model handles from its Gateway service";
const CLIENT =
  "take model handles from the Gateway service in confect/gateway instead of the AI SDK's gateway client";
const MODEL =
  "take model handles from the Gateway service instead of a gateway model ID, which the AI SDK resolves through its default Vercel gateway";

/** Inspects one module with the gateway policy alone. */
function inspect(sourceText: string, file = NINA) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectGatewaySource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

describe("Gateway source policy", () => {
  it.effect("rejects every way of importing the Vercel gateway package", () =>
    Effect.gen(function* () {
      const source = `
import { createGateway } from "@ai-sdk/gateway";
import type { GatewayModelId } from "@ai-sdk/gateway";
export { GatewayError } from "@ai-sdk/gateway";
type Options = import("@ai-sdk/gateway").GatewayProviderOptions;
const loaded = await import("@ai-sdk/gateway");`;
      assert.deepStrictEqual(
        yield* inspect(source),
        Arr.replicate(`${NINA}: ${PACKAGE}.`, 5)
      );
      assert.deepStrictEqual(
        yield* inspect(source, GATEWAY),
        Arr.replicate(`${GATEWAY}: ${PACKAGE}.`, 5)
      );
    })
  );

  it.effect("rejects the AI SDK's gateway client in every form", () =>
    Effect.gen(function* () {
      const violations = yield* inspect(`
import { createGateway as connect, generateText } from "ai";
import { gateway } from "ai";
import * as AI from "ai";
import SDK from "ai";
export { gateway as client } from "ai";
export { createGateway } from "ai";
export * from "ai";
export * as sdk from "ai";
const lite = AI.gateway("google/gemini-3.5-flash-lite");
const pro = SDK.createGateway({}).languageModel("google/gemini-3.7-flash");`);
      assert.deepStrictEqual(
        violations,
        Arr.replicate(`${NINA}: ${CLIENT}.`, 8)
      );
    })
  );

  it.effect(
    "rejects the AI SDK's gateway client inside the gateway module",
    () =>
      Effect.gen(function* () {
        const violations = yield* inspect(
          `import { gateway } from "ai";`,
          GATEWAY
        );
        assert.deepStrictEqual(violations, [`${GATEWAY}: ${CLIENT}.`]);
      })
  );

  it.effect("rejects the Convex provider outside the gateway module", () =>
    Effect.gen(function* () {
      const violations = yield* inspect(`
import { convexGateway } from "@convex-dev/ai-sdk-provider";
export { convexGateway as provider } from "@convex-dev/ai-sdk-provider";
type Provider = import("@convex-dev/ai-sdk-provider").ConvexGatewayProvider;
const loaded = await import("@convex-dev/ai-sdk-provider");`);
      assert.deepStrictEqual(
        violations,
        Arr.replicate(`${NINA}: ${PROVIDER}.`, 4)
      );
    })
  );

  it.effect("allows the Convex provider inside the gateway module", () =>
    Effect.gen(function* () {
      const violations = yield* inspect(
        `import { convexGateway } from "@convex-dev/ai-sdk-provider";
export { convexGateway as provider } from "@convex-dev/ai-sdk-provider";`,
        GATEWAY
      );
      assert.deepStrictEqual(violations, []);
    })
  );

  it.effect("rejects a gateway model ID where the AI SDK takes a model", () =>
    Effect.gen(function* () {
      const violations = yield* inspect(`
await generateText({ model: "google/gemini-3.7-flash", prompt });
const agent = new Agent(components.nina, { languageModel: 'google/gemini-3.5-flash-lite' });
await embed({ model: \`google/\${name}\`, value });
const search = { textEmbeddingModel: \`\${creator}/text-embedding\` };
const model = "openai/gpt-5";
options.embeddingModel = "google/gemini-embedding-001";`);
      assert.deepStrictEqual(
        violations,
        Arr.replicate(`${NINA}: ${MODEL}.`, 6)
      );
    })
  );

  it.effect("allows other AI SDK exports and reading options", () =>
    Effect.gen(function* () {
      const caller = yield* inspect(`
import "ai";
import { generateText, type GatewayModelId } from "ai";
import * as AI from "ai";
export { generateText } from "ai";
export { local };
const sdk = await import("ai");
type Sdk = import("ai").LanguageModel;
type Name = "@ai-sdk/gateway";
const name = "@ai-sdk/gateway";
label("@ai-sdk/gateway");
const text = AI.generateText;
const route = params.providerOptions?.gateway;
const google = { providerOptions: { google: {} } };
const spread = { providerOptions: { ...defaults } };
const shared = { providerOptions: defaults };
const computed = { [key]: { gateway: {} } };
providerOptions.google = {};
options.gateway = {};
call().gateway = {};
const same = route === google;
const providerOptions = params.providerOptions;
const handle = gateway.language({ purpose: "chat", model: "nakafa-pro" });
const { model, timeout } = handle;
const chosen = { model: defaultModel, languageModel: handle.model };
const typed = { model: \`\${key}\` };
const label = { name: "google/gemini-3.7-flash" };`);
      assert.deepStrictEqual(caller, []);
    })
  );

  it.effect("keeps recorded model IDs and provider metadata in tests", () =>
    Effect.gen(function* () {
      const file = "packages/backend/confect/nina/messages.impl.test.ts";
      const violations = yield* inspect(
        `const message = { model: "google/gemini-3.7-flash", provider: "gateway" };
const part = { providerOptions: { gateway: { signature: "continuation" } } };`,
        file
      );
      assert.deepStrictEqual(violations, []);
    })
  );

  it.effect("rejects the Vercel gateway package even in tests", () =>
    Effect.gen(function* () {
      const file = "packages/backend/confect/nina/messages.impl.test.ts";
      const violations = yield* inspect(
        `import { GatewayRateLimitError } from "@ai-sdk/gateway";`,
        file
      );
      assert.deepStrictEqual(violations, [`${file}: ${PACKAGE}.`]);
    })
  );
});
