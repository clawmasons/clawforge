import type { OpenNextConfig } from "@opennextjs/aws/types/open-next.js";

const config: OpenNextConfig = {
  default: {
    override: {
      wrapper: "aws-lambda-streaming",
    },
  },
  buildCommand: "exit 0", // Next.js is already built by `next build`
  packageJsonPath: "../../", // monorepo root for dependency resolution
};

export default config;
