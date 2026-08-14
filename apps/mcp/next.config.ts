import { config, withAnalyzer } from "@repo/next-config";
import { analyzeKeys } from "@repo/next-config/keys";

const configEnv = analyzeKeys();

const analyzedConfig =
  configEnv.ANALYZE === "true" ? withAnalyzer(config) : config;

export default analyzedConfig;
