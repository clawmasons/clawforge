import { z } from "zod";

export const YjsConfigSchema = z.object({
  enabled: z.boolean().optional().default(true),
  host: z.string().min(1).describe("YJS server WebSocket URL"),
  token: z.string().optional().describe("Authentication token"),
  botName: z.string().min(1).describe("Bot name identifier"),
});

export type YjsConfig = z.infer<typeof YjsConfigSchema>;
