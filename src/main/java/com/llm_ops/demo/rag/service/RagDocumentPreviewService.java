package com.llm_ops.demo.rag.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.rag.domain.RagDocument;
import com.llm_ops.demo.rag.domain.RagDocumentStatus;
import com.llm_ops.demo.rag.dto.ChunkPreviewResponse;
import com.llm_ops.demo.rag.dto.DocumentPreviewResponse;
import com.llm_ops.demo.rag.dto.DocumentResponse;
import com.llm_ops.demo.rag.repository.RagDocumentRepository;
import com.llm_ops.demo.rag.storage.S3ApiClient;
import java.util.List;
import org.springframework.ai.document.Document;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.S3Client;

@Service
@ConditionalOnBean(S3Client.class)
public class RagDocumentPreviewService {

    private static final int DEFAULT_PREVIEW_CHARS = 1200;
    private static final int DEFAULT_SAMPLE_CHUNKS = 3;
    private static final int MIN_SAMPLE_CHUNKS = 1;
    private static final int MAX_SAMPLE_CHUNKS = 10;
    private static final int MIN_PREVIEW_CHARS = 200;
    private static final int MAX_PREVIEW_CHARS = 5000;
    private static final long MAX_PREVIEW_FILE_BYTES = 10L * 1024 * 1024;

    private final RagDocumentRepository ragDocumentRepository;
    private final RagDocumentExtractService ragDocumentExtractService;
    private final RagDocumentChunkService ragDocumentChunkService;
    private final S3ApiClient s3ApiClient;

    public RagDocumentPreviewService(
            RagDocumentRepository ragDocumentRepository,
            RagDocumentExtractService ragDocumentExtractService,
            RagDocumentChunkService ragDocumentChunkService,
            S3ApiClient s3ApiClient
    ) {
        this.ragDocumentRepository = ragDocumentRepository;
        this.ragDocumentExtractService = ragDocumentExtractService;
        this.ragDocumentChunkService = ragDocumentChunkService;
        this.s3ApiClient = s3ApiClient;
    }

    public DocumentPreviewResponse preview(Long workspaceId, Long documentId, Integer sampleCount, Integer previewChars) {
        if (workspaceId == null || workspaceId <= 0 || documentId == null || documentId <= 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "workspaceId와 documentId가 필요합니다.");
        }

        RagDocument document = ragDocumentRepository.findByIdAndWorkspaceId(documentId, workspaceId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "문서를 찾을 수 없습니다."));

        if (document.getStatus() == RagDocumentStatus.DELETED || document.getStatus() == RagDocumentStatus.DELETING) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "문서를 찾을 수 없습니다.");
        }
        if (document.getFileUrl() == null || document.getFileUrl().isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "문서 파일 경로가 없습니다.");
        }

        int resolvedSampleCount = clamp(sampleCount != null ? sampleCount : DEFAULT_SAMPLE_CHUNKS,
                MIN_SAMPLE_CHUNKS, MAX_SAMPLE_CHUNKS);
        int resolvedPreviewChars = clamp(previewChars != null ? previewChars : DEFAULT_PREVIEW_CHARS,
                MIN_PREVIEW_CHARS, MAX_PREVIEW_CHARS);

        try {
            long contentLength = s3ApiClient.getContentLength(document.getFileUrl());
            if (contentLength > MAX_PREVIEW_FILE_BYTES) {
                throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "미리보기용 파일이 너무 큽니다.");
            }
            byte[] bytes = s3ApiClient.downloadDocumentBytes(document.getFileUrl());
            Resource resource = new ByteArrayResource(bytes) {
                @Override
                public String getFilename() {
                    return document.getFileName();
                }
            };
            List<Document> extracted = ragDocumentExtractService.extract(workspaceId, resource);
            List<Document> chunks = ragDocumentChunkService.chunk(extracted, documentId, document.getFileName());

            String preview = buildPreview(extracted, resolvedPreviewChars);
            List<ChunkPreviewResponse> samples = chunks.stream()
                    .limit(resolvedSampleCount)
                    .map(ChunkPreviewResponse::from)
                    .toList();

            return DocumentPreviewResponse.of(
                    DocumentResponse.from(document),
                    preview,
                    samples,
                    chunks.size()
            );
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "문서 미리보기에 실패했습니다.");
        }
    }

    private String buildPreview(List<Document> extracted, int maxChars) {
        if (extracted == null || extracted.isEmpty()) {
            return "";
        }
        StringBuilder builder = new StringBuilder();
        for (Document document : extracted) {
            String content = document.getContent();
            if (content == null || content.isBlank()) {
                continue;
            }
            int remaining = maxChars - builder.length();
            if (remaining <= 0) {
                break;
            }
            if (content.length() > remaining) {
                builder.append(content, 0, remaining);
                break;
            }
            builder.append(content).append("\n\n");
        }
        return builder.toString().trim();
    }

    private int clamp(int value, int min, int max) {
        return Math.min(Math.max(value, min), max);
    }
}
