import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ErrorResponse } from '@/types/api.types';

export function createAxiosApiError(status: number, code: string, message: string): AxiosError<ErrorResponse> {
  const config = { headers: {} } as InternalAxiosRequestConfig;
  const response = {
    status,
    statusText: 'Error',
    headers: {},
    config,
    data: {
      code,
      message,
      timestamp: '2026-02-18T00:00:00',
      fieldErrors: null,
    },
  };

  return new AxiosError<ErrorResponse>(message, undefined, config, undefined, response);
}
