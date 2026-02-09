import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@clawforge/shared";

export const trpc = createTRPCReact<AppRouter>();
