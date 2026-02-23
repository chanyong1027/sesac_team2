package com.llm_ops.demo.gateway.log.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * RAG 검색 결과 문서 엔티티
 * - 요청 1건에 대해 검색된 N개의 문서 정보를 저장
 */
@Entity
@Getter
@Table(name = "retrieved_documents")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RetrievedDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "request_id", nullable = false)
    private RequestLog requestLog;

    @Column(name = "document_name", length = 512)
    private String documentName;

    @Column(name = "score")
    private Double score;

    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    @Column(name = "duration_ms")
    private Integer durationMs;

    @Column(name = "ranking", nullable = false)
    private Integer ranking;

    public static RetrievedDocument create(
            RequestLog requestLog,
            String documentName,
            Double score,
            String content,
            Integer durationMs,
            Integer ranking) {
        RetrievedDocument doc = new RetrievedDocument();
        doc.requestLog = requestLog;
        doc.documentName = documentName;
        doc.score = score;
        doc.content = content;
        doc.durationMs = durationMs;
        doc.ranking = ranking != null ? ranking : 0;
        return doc;
    }
}
