import type { NextConfig } from "next";
import { join } from "node:path";
import { createMDX } from "fumadocs-mdx/next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: join(import.meta.dirname, "../../"),
  outputFileTracingIncludes: {
    "/**/*": [
      "./node_modules/@next/env/**/*",
      "./node_modules/styled-jsx/**/*",
      "./node_modules/@swc/helpers/**/*",
    ],
  },
};

const withMDX = createMDX();

export default withMDX(nextConfig);
