import { withAnalyzer, withMDX } from "@repo/next-config";
import type { NextConfig } from "next";
import { env } from "@/env";

let nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Copy contents directory to the build output
    if (isServer) {
      const CopyPlugin = require("copy-webpack-plugin");
      config.plugins.push(
        new CopyPlugin({
          patterns: [
            {
              from: "../../packages/contents",
              to: "packages/contents",
              globOptions: {
                ignore: ["**/node_modules/**", "**/.git/**", "**/package.json"],
              },
            },
          ],
        })
      );
    }
    return config;
  },
};

if (env.ANALYZE === "true") {
  nextConfig = withAnalyzer(nextConfig);
}

export default withMDX(nextConfig);
