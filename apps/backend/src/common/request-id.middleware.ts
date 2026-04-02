import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export type RequestWithRequestId = Request & {
  requestId?: string;
};

function extractRequestId(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function requestIdMiddleware(
  request: RequestWithRequestId,
  response: Response,
  next: NextFunction,
): void {
  const requestId = extractRequestId(request.headers['x-request-id']) ?? randomUUID();

  request.requestId = requestId;
  request.headers['x-request-id'] = requestId;
  response.setHeader('x-request-id', requestId);

  next();
}
