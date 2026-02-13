import os from "node:os";

export type Platform = "linux-x86_64" | "linux-arm64" | "macos";

/** Detect the current OS+arch as a platform string */
export function detectPlatform(): Platform {
  const platform = os.platform();
  const arch = os.arch();

  if (platform === "darwin") return "macos";
  if (platform === "linux" && arch === "arm64") return "linux-arm64";
  return "linux-x86_64";
}
