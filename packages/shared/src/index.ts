// Re-export the AppRouter type from the API package.
// This gives the web client type-safe access to tRPC procedures
// without depending on the full API package.
export type { AppRouter } from "@clawforge/api/router";
