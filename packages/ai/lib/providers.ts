import {
  createGateway,
  gateway as defaultGateway,
  type GatewayModelId,
} from "@ai-sdk/gateway";
import { customProvider } from "ai";

const languageModels: Record<"google" | "moonshot", GatewayModelId> = {
  google: "google/gemini-2.5-flash",
  moonshot: "moonshotai/kimi-k2",
};

export type ModelId = keyof typeof languageModels;

export const MODELS = Object.keys(languageModels) as ModelId[];

export const defaultModel: ModelId = "moonshot";

export class Model {
  private readonly provider: ReturnType<typeof customProvider>;

  constructor(options?: { apiKey?: string }) {
    const gateway = options?.apiKey
      ? createGateway({ apiKey: options.apiKey })
      : defaultGateway;

    this.provider = customProvider({
      languageModels: {
        google: gateway(languageModels.google),
        moonshot: gateway(languageModels.moonshot),
      },
    });
  }

  languageModel(id: ModelId = defaultModel) {
    return this.provider.languageModel(id);
  }
}
