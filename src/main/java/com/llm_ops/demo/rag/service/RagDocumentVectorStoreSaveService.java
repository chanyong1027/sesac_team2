package com.llm_ops.demo.rag.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 청킹된 문서를 벡터 스토어에 저장하는 서비스입니다.
 * RAG(Retrieval-Augmented Generation) 파이프라인의 핵심 구성 요소로,
 * 문서 조각(chunk)을 벡터화하여 효율적인 검색이 가능하도록 합니다.
 */
@Service
@ConditionalOnBean(VectorStore.class) // VectorStore 빈이 있을 때만 활성화
@ConditionalOnProperty(prefix = "rag.vectorstore.pgvector", name = "enabled", havingValue = "true") // pgvector 사용 설정 시 활성화
public class RagDocumentVectorStoreSaveService {

    private static final String METADATA_WORKSPACE_ID = "workspace_id";
    private static final String METADATA_DOCUMENT_ID = "document_id";

    private final VectorStore vectorStore;

    /**
     * VectorStore를 주입받아 서비스를 초기화합니다.
     * @param vectorStore 문서 벡터 저장을 담당하는 VectorStore 구현체
     */
    public RagDocumentVectorStoreSaveService(VectorStore vectorStore) {
        this.vectorStore = vectorStore;
    }

    /**
     * 청킹된 문서 목록을 받아서 벡터 스토어에 저장합니다.
     * 각 문서 청크에는 검색 필터링을 위한 메타데이터(workspaceId, documentId)가 추가됩니다.
     *
     * @param workspaceId 문서가 속한 워크스페이스의 ID (멀티테넌시 격리용)
     * @param documentId  원본 문서의 ID (선택 사항, 추후 필수 예정)
     * @param chunks      벡터 스토어에 저장할 {@link Document} 청크 목록
     * @return 성공적으로 저장된 문서 청크의 수
     * @throws BusinessException 입력 값이 유효하지 않을 경우
     */
    public int save(Long workspaceId, Long documentId, List<Document> chunks) {
        validateInput(workspaceId, documentId, chunks); // 입력 유효성 검증

        List<Document> enriched = new ArrayList<>();
        for (Document document : chunks) {
            enriched.add(applyMetadata(document, workspaceId, documentId)); // 문서에 메타데이터 추가
        }

        vectorStore.add(enriched); // 벡터 스토어에 문서 저장
        return enriched.size();
    }

    /**
     * 문서 저장 요청의 입력 파라미터를 유효성 검증합니다.
     */
    private void validateInput(Long workspaceId, Long documentId, List<Document> chunks) {
        if (workspaceId == null || workspaceId <= 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "workspaceId가 필요합니다.");
        }
        if (documentId != null && documentId <= 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "documentId가 올바르지 않습니다.");
        }
        if (chunks == null || chunks.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "저장할 문서 청크가 필요합니다.");
        }
    }

    /**
     * 문서 청크에 워크스페이스 ID와 문서 ID 메타데이터를 추가합니다.
     * 이 메타데이터는 RAG 검색 시 필터링 조건으로 사용됩니다.
     */
    private Document applyMetadata(Document document, Long workspaceId, Long documentId) {
        Map<String, Object> metadata = new HashMap<>(document.getMetadata());
        metadata.put(METADATA_WORKSPACE_ID, workspaceId); // 워크스페이스 ID 추가 (tenant isolation)
        if (documentId != null) {
            metadata.put(METADATA_DOCUMENT_ID, documentId); // 문서 ID 추가
        }

        Document enriched = document.mutate() // 기존 문서 객체에 메타데이터를 추가하여 새로운 문서 객체 생성
                .metadata(metadata)
                .build();
        if (document.getContentFormatter() != null) {
            enriched.setContentFormatter(document.getContentFormatter()); // 기존 포맷터 유지
        }
        return enriched;
    }
}
