/** Plugin configuration read from environment variables */
export interface YjsPluginConfig {
  /** WebSocket URL for the space-server (e.g. ws://space-server:1234) */
  host: string;
  /** Optional auth token */
  token?: string;
  /** Bot identity — must match the `bot` field in prompt Y.Maps (or "*" matches all) */
  botName: string;
}
