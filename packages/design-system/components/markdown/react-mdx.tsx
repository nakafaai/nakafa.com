import { reactCodeComponents } from "@repo/design-system/components/markdown/react-code";
import { reactTableComponents } from "@repo/design-system/components/markdown/react-table";
import { reactTextComponents } from "@repo/design-system/components/markdown/react-text";
import type { Options } from "react-markdown";

export const reactMdxComponents: Options["components"] = {
  ...reactCodeComponents,
  ...reactTableComponents,
  ...reactTextComponents,
};
