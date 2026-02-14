import api from './axios';
import type { ApiResponse, RequestLogListResponse, RequestLogResponse } from '@/types/api.types';

export const logsApi = {
  list: async (
    workspaceId: number,
    params?: {
      page?: number;
      size?: number;
      status?: string;
      provider?: string;
      usedModel?: string;
      ragEnabled?: boolean;
      promptKey?: string;
      traceId?: string;
      from?: string;
      to?: string;
    }
  ): Promise<RequestLogListResponse> => {
    const res = await api.get<ApiResponse<RequestLogListResponse>>(
      `/workspaces/${workspaceId}/logs`,
      { params }
    );
    return res.data.data;
  },

  get: async (workspaceId: number, traceId: string): Promise<RequestLogResponse> => {
    // MOCK DATA FOR UI DEV
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      requestId: crypto.randomUUID(),
      traceId,
      status: 'SUCCESS',
      httpStatus: 200,
      latencyMs: 1220,
      provider: 'OpenAI',
      requestedModel: 'gpt-4o',
      usedModel: 'gpt-4o-mini',
      isFailover: true,
      inputTokens: 150,
      outputTokens: 320,
      totalTokens: 470,
      promptKey: 'rag-query-v1',
      ragEnabled: true,
      ragLatencyMs: 50,
      ragChunksCount: 3,
      ragTopK: 5,
      ragSimilarityThreshold: 0.75,
      requestPath: '/v1/chat/completions',
      errorCode: null,
      errorMessage: null,
      failReason: null,
      createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      finishedAt: new Date(Date.now() - 1000 * 60 * 5 + 1220).toISOString(),
      requestPayload: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a helpful AI assistant." },
          { role: "user", content: "Explain quantum entanglement." }
        ],
        temperature: 0.7
      }, null, 2),
      responsePayload: JSON.stringify({
        id: "chatcmpl-123",
        object: "chat.completion",
        created: 1677652288,
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: "Quantum entanglement is a physical phenomenon..."
          },
          finish_reason: "stop"
        }],
        usage: {
          prompt_tokens: 150,
          completion_tokens: 320,
          total_tokens: 470
        }
      }, null, 2),
      requestSource: 'GATEWAY',
      cost: 0.0823,
      retrievedDocuments: [
        {
          id: 1,
          content: "Quantum physics basics...",
          score: 0.92,
          documentId: 101,
          documentName: "physics_101.pdf"
        },
        {
          id: 2,
          content: "Advanced Quantum Mechanics...",
          score: 0.75,
          documentId: 102,
          documentName: "advanced_qm.pdf"
        },
        {
          id: 3,
          content: "Entanglement Theory...",
          score: 0.61,
          documentId: 103,
          documentName: "entanglement.docx"
        }
      ]
    };
  },
};
