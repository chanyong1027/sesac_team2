package com.llm_ops.demo.rag.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.rag.domain.RagDocument;
import com.llm_ops.demo.rag.domain.RagDocumentStatus;
import com.llm_ops.demo.rag.repository.RagDocumentRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RagDocumentListService {

    private final RagDocumentRepository ragDocumentRepository;

    @Transactional(readOnly = true)
    public List<RagDocument> findActiveDocuments(Long workspaceId) {
        if (workspaceId == null || workspaceId <= 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "workspaceId가 필요합니다.");
        }
        return ragDocumentRepository.findAllByWorkspaceIdAndStatusNotOrderByCreatedAtDesc(
                workspaceId,
                RagDocumentStatus.DELETED
        );
    }
}
