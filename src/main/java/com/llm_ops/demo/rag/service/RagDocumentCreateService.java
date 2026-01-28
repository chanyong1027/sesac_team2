package com.llm_ops.demo.rag.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.rag.domain.RagDocument;
import com.llm_ops.demo.rag.repository.RagDocumentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RagDocumentCreateService {

    private final RagDocumentRepository ragDocumentRepository;

    @Transactional
    public RagDocument create(Long workspaceId, String fileName, String fileUrl) {
        validateInput(workspaceId, fileName, fileUrl);
        RagDocument document = RagDocument.create(workspaceId, fileName, fileUrl);
        return ragDocumentRepository.save(document);
    }

    private void validateInput(Long workspaceId, String fileName, String fileUrl) {
        if (workspaceId == null || workspaceId <= 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "workspaceId가 필요합니다.");
        }
        if (fileName == null || fileName.trim().isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "fileName이 필요합니다.");
        }
        if (fileUrl == null || fileUrl.trim().isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "fileUrl이 필요합니다.");
        }

        String expectedPrefix = String.format("workspaces/%d/documents/", workspaceId);
        if (!fileUrl.trim().startsWith(expectedPrefix)) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT_VALUE,
                    "fileUrl은 '" + expectedPrefix + "' 로 시작해야 합니다."
            );
        }
    }
}
