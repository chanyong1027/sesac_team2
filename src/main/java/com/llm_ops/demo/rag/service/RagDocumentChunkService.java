package com.llm_ops.demo.rag.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import org.springframework.ai.document.Document;
import org.springframework.stereotype.Service;

import com.llm_ops.demo.rag.metadata.RagMetadataKeys;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 추출된 문서를 문단 우선 + 토큰 오버랩 방식으로 청킹하는 서비스입니다.
 */
@Service
public class RagDocumentChunkService {

    private final RagTextSplitter ragTextSplitter;

    public RagDocumentChunkService(RagTextSplitter ragTextSplitter) {
        this.ragTextSplitter = ragTextSplitter;
    }

    /**
     * 문서 목록을 토큰 기준으로 청킹합니다.
     *
     * @param documents  Tika 추출 결과 문서 목록
     * @param documentId 문서 마스터 ID (현재는 optional, 추후 필수 예정)
     * @return 청크 단위로 분할된 문서 목록
     */
    public List<Document> chunk(List<Document> documents, Long documentId, String documentName) {
        return chunk(documents, documentId, documentName, null, null);
    }

    public List<Document> chunk(
        List<Document> documents,
        Long documentId,
        String documentName,
        Integer chunkSizeOverride,
        Integer chunkOverlapTokensOverride
    ) {
        validateInput(documents, documentId);

        List<Document> results = new ArrayList<>();
        for (Document document : documents) {
            List<Document> chunks = ragTextSplitter.split(document, chunkSizeOverride, chunkOverlapTokensOverride);
            int total = chunks.size();
            for (int index = 0; index < total; index++) {
                Document chunk = chunks.get(index);
                results.add(applyChunkMetadata(chunk, index, total, documentId, documentName));
            }
        }

        if (results.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "문서에서 청킹할 수 있는 내용이 없습니다.");
        }
        return results;
    }

    private void validateInput(List<Document> documents, Long documentId) {
        if (documents == null || documents.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "청킹할 문서가 필요합니다.");
        }
        if (documentId != null && documentId <= 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "documentId가 올바르지 않습니다.");
        }
    }

    private Document applyChunkMetadata(Document document, int chunkIndex, int chunkTotal, Long documentId, String documentName) {
        Map<String, Object> metadata = new HashMap<>(document.getMetadata());
        metadata.put(RagMetadataKeys.CHUNK_INDEX, chunkIndex);
        metadata.put(RagMetadataKeys.CHUNK_TOTAL, chunkTotal);
        if (documentId != null) {
            metadata.put(RagMetadataKeys.DOCUMENT_ID, documentId);
        }
        if (documentName != null && !documentName.isBlank()) {
            metadata.put(RagMetadataKeys.DOCUMENT_NAME, documentName);
        }
        Document chunk = new Document(document.getContent(), metadata);
        chunk.setContentFormatter(document.getContentFormatter());
        return chunk;
    }
}
