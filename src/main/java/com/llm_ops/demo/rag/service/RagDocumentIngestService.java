package com.llm_ops.demo.rag.service;

import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.document.Document;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

/**
 * 문서 업로드 이후 RAG 인게스트 파이프라인(추출 → 청킹 → 벡터 저장)을 수행합니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnBean(RagDocumentVectorStoreSaveService.class)
@ConditionalOnProperty(prefix = "rag.vectorstore.pgvector", name = "enabled", havingValue = "true")
public class RagDocumentIngestService {

    private final RagDocumentExtractService ragDocumentExtractService;
    private final RagDocumentChunkService ragDocumentChunkService;
    private final RagDocumentVectorStoreSaveService ragDocumentVectorStoreSaveService;

    public int ingest(Long workspaceId, Long documentId, Resource resource) {
        long startNs = System.nanoTime();
        String stage = "start";
        try {
            stage = "extract";
            long extractStartNs = System.nanoTime();
            List<Document> extracted = ragDocumentExtractService.extract(workspaceId, resource);
            long extractMs = (System.nanoTime() - extractStartNs) / 1_000_000;
            log.info(
                    "RAG ingest extract done workspaceId={} documentId={} resource={} extractedCount={} tookMs={}",
                    workspaceId,
                    documentId,
                    resource != null ? resource.getFilename() : null,
                    extracted.size(),
                    extractMs
            );

            stage = "chunk";
            long chunkStartNs = System.nanoTime();
            List<Document> chunks = ragDocumentChunkService.chunk(extracted, documentId);
            long chunkMs = (System.nanoTime() - chunkStartNs) / 1_000_000;
            log.info(
                    "RAG ingest chunk done workspaceId={} documentId={} chunkCount={} tookMs={}",
                    workspaceId,
                    documentId,
                    chunks.size(),
                    chunkMs
            );

            stage = "save";
            long saveStartNs = System.nanoTime();
            int savedCount = ragDocumentVectorStoreSaveService.save(workspaceId, documentId, chunks);
            long saveMs = (System.nanoTime() - saveStartNs) / 1_000_000;
            long totalMs = (System.nanoTime() - startNs) / 1_000_000;
            log.info(
                    "RAG ingest save done workspaceId={} documentId={} savedCount={} tookMs={} totalMs={} (extract+chunk+save)",
                    workspaceId,
                    documentId,
                    savedCount,
                    saveMs,
                    totalMs
            );
            return savedCount;
        } catch (RuntimeException ex) {
            long elapsedMs = (System.nanoTime() - startNs) / 1_000_000;
            log.warn(
                    "RAG ingest failed stage={} workspaceId={} documentId={} resource={} elapsedMs={}",
                    stage,
                    workspaceId,
                    documentId,
                    resource != null ? resource.getFilename() : null,
                    elapsedMs,
                    ex
            );
            throw ex;
        }
    }
}
