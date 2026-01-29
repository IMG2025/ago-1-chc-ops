import { callTool } from "./gateway";
import type { ToolRequest, ToolResponse } from "./envelopes";
import { createHttpToolTransport } from "./transports/httpTransport";

export type McpClientConfig = {
  baseUrl: string; // e.g. http://127.0.0.1:8787
};

export function createMcpClient(cfg: McpClientConfig) {
  const transport = createHttpToolTransport({ baseUrl: cfg.baseUrl });

  return {
    async invoke<T = unknown>(req: ToolRequest): Promise<ToolResponse<T>> {
      return (await callTool(transport, req)) as ToolResponse<T>;
    }
  };
}
