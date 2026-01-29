package com.llm_ops.demo.rag.controller;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.rag.domain.RagDocument;
import com.llm_ops.demo.rag.dto.DocumentDeleteResponse;
import com.llm_ops.demo.rag.dto.DocumentResponse;
import com.llm_ops.demo.rag.dto.DocumentUploadResponse;
import com.llm_ops.demo.rag.service.RagDocumentCreateService;
import com.llm_ops.demo.rag.service.RagDocumentDeleteService;
import com.llm_ops.demo.rag.service.RagDocumentIngestService;
import com.llm_ops.demo.rag.service.RagDocumentListService;
import com.llm_ops.demo.rag.service.RagDocumentVectorStoreDeleteService;
import com.llm_ops.demo.rag.storage.S3ApiClient;
import com.llm_ops.demo.workspace.service.WorkspaceAccessService;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(prefix = "storage.s3", name = "enabled", havingValue = "true")
@Validated
public class DocumentController {

    private final S3ApiClient s3ApiClient;
    private final RagDocumentCreateService ragDocumentCreateService;
    private final RagDocumentListService ragDocumentListService;
    private final RagDocumentDeleteService ragDocumentDeleteService;
    private final ObjectProvider<RagDocumentIngestService> ragDocumentIngestServiceProvider;
    private final ObjectProvider<RagDocumentVectorStoreDeleteService> ragDocumentVectorStoreDeleteServiceProvider;
    private final WorkspaceAccessService workspaceAccessService;

    @PostMapping(value = "/workspaces/{workspaceId}/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<DocumentUploadResponse> uploadDocument(
        @PathVariable @NotNull @Positive Long workspaceId,
        @RequestPart("file") MultipartFile file,
        @AuthenticationPrincipal Long userId
    ) {
        validateFile(file);
        workspaceAccessService.validateWorkspaceAccess(workspaceId, userId);

        String fileUrl = null;
        RagDocument createdDocument = null;
        try {
            String originalFilename = file.getOriginalFilename();
            String fileName = StringUtils.hasText(originalFilename) ? originalFilename : "file";
            fileUrl = uploadToS3(workspaceId, fileName, file);

            createdDocument = ragDocumentCreateService.create(workspaceId, fileName, fileUrl);
            RagDocumentIngestService ingestService = ragDocumentIngestServiceProvider.getIfAvailable();
            if (ingestService != null) {
                ingestService.ingest(workspaceId, createdDocument.getId(), file.getResource());
            }

            return ResponseEntity.ok(DocumentUploadResponse.from(createdDocument));
        } catch (Exception e) {
            if (fileUrl != null) {
                try {
                    s3ApiClient.deleteDocument(fileUrl);
                    log.info("S3 cleanup succeeded for {}", fileUrl);
                } catch (Exception cleanupEx) {
                    log.error("S3 cleanup failed for {}", fileUrl, cleanupEx);
                }
            }
            if (createdDocument != null) {
                try {
                    ragDocumentDeleteService.delete(createdDocument);
                    log.info("Document cleanup succeeded for workspaceId={}, documentId={}",
                            workspaceId, createdDocument.getId());
                } catch (Exception cleanupEx) {
                    log.error("Document cleanup failed for workspaceId={}, documentId={}",
                            workspaceId, createdDocument.getId(), cleanupEx);
                }
            }
            throw e;
        }
    }

    @GetMapping("/workspaces/{workspaceId}/documents")
    public ResponseEntity<List<DocumentResponse>> getDocuments(
        @PathVariable @NotNull @Positive Long workspaceId,
        @AuthenticationPrincipal Long userId
    ) {
        workspaceAccessService.validateWorkspaceAccess(workspaceId, userId);
        
        List<DocumentResponse> response = ragDocumentListService.findActiveDocuments(workspaceId).stream()
                .map(DocumentResponse::from)
                .toList();
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/workspaces/{workspaceId}/documents/{documentId}")
    public ResponseEntity<DocumentDeleteResponse> deleteDocument(
        @PathVariable @NotNull @Positive Long workspaceId,
        @PathVariable @NotNull @Positive Long documentId,
        @AuthenticationPrincipal Long userId
    ) {
        workspaceAccessService.validateWorkspaceAccess(workspaceId, userId);

        RagDocument target = ragDocumentDeleteService.getDocument(workspaceId, documentId);
        s3ApiClient.deleteDocument(target.getFileUrl());
        RagDocument deleted = ragDocumentDeleteService.delete(target);

        RagDocumentVectorStoreDeleteService vectorStoreDeleteService =
                ragDocumentVectorStoreDeleteServiceProvider.getIfAvailable();
        if (vectorStoreDeleteService != null) {
            vectorStoreDeleteService.deleteByDocumentId(documentId);
        }

        return ResponseEntity.ok(DocumentDeleteResponse.of(documentId, "삭제되었습니다."));
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "업로드할 파일이 필요합니다.");
        }
    }

    private String uploadToS3(Long workspaceId, String fileName, MultipartFile file) {
        Map<String, String> metadata = new HashMap<>();
        metadata.put("workspace_id", String.valueOf(workspaceId));
        metadata.put("original_filename", fileName);

        try (InputStream inputStream = file.getInputStream()) {
            return s3ApiClient.uploadDocument(
                    workspaceId,
                    fileName,
                    inputStream,
                    file.getSize(),
                    file.getContentType(),
                    metadata
            );
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "문서 파일을 읽을 수 없습니다.");
        }
    }
}
