import type { NextConfig } from "next";
import { join } from "node:path";

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

export default nextConfig;
