/**
 * Audit Log Types
 */

export interface ToolExecutionEvent {
  eventId: string;
  timestamp: string;
  toolName: string;
  caller: {
    tenant: string;
    actor?: string;
    traceId?: string;
  };
  args: Record<string, unknown>;
  result: {
    success: boolean;
    data?: unknown;
    error?: {
      code: string;
      message: string;
    };
  };
  duration: number;
  scopes: string[];
  authorized: boolean;
}

export interface AuditFilter {
  tenant?: string;
  toolName?: string;
  startTime?: string;
  endTime?: string;
  success?: boolean;
  limit?: number;
}
