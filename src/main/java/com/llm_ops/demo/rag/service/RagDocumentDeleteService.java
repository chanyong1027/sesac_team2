package com.llm_ops.demo.rag.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.rag.domain.RagDocument;
import com.llm_ops.demo.rag.domain.RagDocumentStatus;
import com.llm_ops.demo.rag.repository.RagDocumentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RagDocumentDeleteService {

    private final RagDocumentRepository ragDocumentRepository;

    public RagDocumentDeleteService(RagDocumentRepository ragDocumentRepository) {
        this.ragDocumentRepository = ragDocumentRepository;
    }

    @Transactional
    public void delete(Long workspaceId, Long documentId) {
        deleteInternal(workspaceId, documentId);
    }

    private void validateInput(Long workspaceId, Long documentId) {
        if (workspaceId == null || workspaceId <= 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "workspaceId가 필요합니다.");
        }
        if (documentId == null || documentId <= 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "documentId가 필요합니다.");
        }
    }

    @Transactional
    public RagDocument deleteByDocumentId(Long documentId) {
        if (documentId == null || documentId <= 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "documentId가 필요합니다.");
        }

        RagDocument document = ragDocumentRepository.findById(documentId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "문서를 찾을 수 없습니다."));

        if (document.getStatus() == RagDocumentStatus.DELETED) {
            return document;
        }

        document.markDeleted();
        return ragDocumentRepository.save(document);
    }

    private RagDocument deleteInternal(Long workspaceId, Long documentId) {
        validateInput(workspaceId, documentId);

        RagDocument document = ragDocumentRepository.findByIdAndWorkspaceId(documentId, workspaceId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "문서를 찾을 수 없습니다."));

        if (document.getStatus() == RagDocumentStatus.DELETED) {
            return document;
        }

        document.markDeleted();
        return ragDocumentRepository.save(document);
    }
}
