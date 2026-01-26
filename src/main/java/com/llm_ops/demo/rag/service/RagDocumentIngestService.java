package com.llm_ops.demo.rag.service;

import org.springframework.ai.document.Document;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 문서 업로드 이후 RAG 인게스트 파이프라인(추출 → 청킹 → 벡터 저장)을 수행합니다.
 */
@Service
@ConditionalOnBean(RagDocumentVectorStoreSaveService.class)
@ConditionalOnProperty(prefix = "rag.vectorstore.pgvector", name = "enabled", havingValue = "true")
public class RagDocumentIngestService {

    private final RagDocumentExtractService ragDocumentExtractService;
    private final RagDocumentChunkService ragDocumentChunkService;
    private final RagDocumentVectorStoreSaveService ragDocumentVectorStoreSaveService;

    public RagDocumentIngestService(RagDocumentExtractService ragDocumentExtractService,
                                    RagDocumentChunkService ragDocumentChunkService,
                                    RagDocumentVectorStoreSaveService ragDocumentVectorStoreSaveService) {
        this.ragDocumentExtractService = ragDocumentExtractService;
        this.ragDocumentChunkService = ragDocumentChunkService;
        this.ragDocumentVectorStoreSaveService = ragDocumentVectorStoreSaveService;
    }

    public int ingest(Long workspaceId, Long documentId, Resource resource) {
        List<Document> extracted = ragDocumentExtractService.extract(workspaceId, resource);
        List<Document> chunks = ragDocumentChunkService.chunk(extracted, documentId);
        return ragDocumentVectorStoreSaveService.save(workspaceId, documentId, chunks);
    }
}
