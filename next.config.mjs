import createMDX from "@next/mdx";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const pluginRules = { strict: true, throwOnError: true };

const withMDX = createMDX({
  options: {
    remarkPlugins: [
      ["remark-gfm", pluginRules],
      ["remark-math", pluginRules],
    ],
    rehypePlugins: [["rehype-katex", pluginRules]],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
};

export default withNextIntl(withMDX(nextConfig));
