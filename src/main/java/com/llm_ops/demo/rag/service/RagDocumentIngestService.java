package com.llm_ops.demo.rag.service;

import com.llm_ops.demo.rag.domain.RagDocument;
import com.llm_ops.demo.rag.domain.RagDocumentStatus;
import com.llm_ops.demo.rag.repository.RagDocumentRepository;
import com.llm_ops.demo.workspace.service.WorkspaceRagSettingsService;
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
    private final RagTextNormalizer ragTextNormalizer;
    private final RagDocumentChunkService ragDocumentChunkService;
    private final RagDocumentVectorStoreSaveService ragDocumentVectorStoreSaveService;
    private final RagDocumentRepository ragDocumentRepository;
    private final WorkspaceRagSettingsService workspaceRagSettingsService;

    public int ingest(Long workspaceId, Long documentId, Resource resource) {
        long startNs = System.nanoTime();
        String stage = "start";
        try {
            updateStatus(documentId, RagDocumentStatus.PARSING);
            stage = "extract";
            long extractStartNs = System.nanoTime();
            List<Document> extracted = ragDocumentExtractService.extract(workspaceId, resource);
            List<Document> normalized = ragTextNormalizer.normalize(extracted);
            long extractMs = (System.nanoTime() - extractStartNs) / 1_000_000;
            log.info(
                    "RAG ingest extract done workspaceId={} documentId={} resource={} extractedCount={} tookMs={}",
                    workspaceId,
                    documentId,
                    resource != null ? resource.getFilename() : null,
                    normalized.size(),
                    extractMs
            );

            updateStatus(documentId, RagDocumentStatus.CHUNKING);
            stage = "chunk";
            long chunkStartNs = System.nanoTime();
            String documentName = resource != null ? resource.getFilename() : null;
            WorkspaceRagSettingsService.RagRuntimeSettings ragSettings =
                    workspaceRagSettingsService.resolveRuntimeSettings(workspaceId);
            List<Document> chunks = ragDocumentChunkService.chunk(
                    normalized,
                    documentId,
                    documentName,
                    ragSettings.chunkSize(),
                    ragSettings.chunkOverlapTokens()
            );
            long chunkMs = (System.nanoTime() - chunkStartNs) / 1_000_000;
            log.info(
                    "RAG ingest chunk done workspaceId={} documentId={} documentName={} chunkCount={} tookMs={}",
                    workspaceId,
                    documentId,
                    documentName,
                    chunks.size(),
                    chunkMs
            );

            updateStatus(documentId, RagDocumentStatus.EMBEDDING);
            stage = "save";
            long saveStartNs = System.nanoTime();
            int savedCount = ragDocumentVectorStoreSaveService.save(workspaceId, documentId, chunks);
            long saveMs = (System.nanoTime() - saveStartNs) / 1_000_000;
            updateStatus(documentId, RagDocumentStatus.INDEXING);
            updateStatus(documentId, RagDocumentStatus.DONE);
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
            updateStatus(documentId, RagDocumentStatus.FAILED);
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

    private void updateStatus(Long documentId, RagDocumentStatus status) {
        if (documentId == null) {
            return;
        }
        ragDocumentRepository.findById(documentId).ifPresent(document -> {
            switch (status) {
                case PARSING -> document.markParsing();
                case CHUNKING -> document.markChunking();
                case EMBEDDING -> document.markEmbedding();
                case INDEXING -> document.markIndexing();
                case DONE -> document.markDone();
                case FAILED -> document.markFailed();
                default -> {
                    return;
                }
            }
            ragDocumentRepository.save(document);
        });
    }
}
