package com.llm_ops.demo.rag.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.rag.domain.RagDocument;
import com.llm_ops.demo.rag.domain.RagDocumentStatus;
import com.llm_ops.demo.rag.repository.RagDocumentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RagDocumentDeleteService {

    private final RagDocumentRepository ragDocumentRepository;

    @Transactional
    public RagDocument delete(Long workspaceId, Long documentId) {
        validateInput(workspaceId, documentId);
        RagDocument document = ragDocumentRepository.findByIdAndWorkspaceId(documentId, workspaceId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "문서를 찾을 수 없습니다."));
        if (document.getStatus() == RagDocumentStatus.DELETED) {
            return document;
        }
        document.markDeleted();
        return ragDocumentRepository.save(document);
    }

    private void validateInput(Long workspaceId, Long documentId) {
        if (workspaceId == null || workspaceId <= 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "workspaceId가 필요합니다.");
        }
        if (documentId == null || documentId <= 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "documentId가 필요합니다.");
        }
    }
}
