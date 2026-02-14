package com.llm_ops.demo.gateway.log.repository;

import com.llm_ops.demo.gateway.log.domain.RequestLog;
import com.llm_ops.demo.gateway.log.dto.RequestLogSearchCondition;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

/**
 * RequestLog 동적 쿼리 조건 생성
 */
public class RequestLogSpecification {

    private RequestLogSpecification() {
        // Utility class
    }

    public static Specification<RequestLog> searchByCondition(Long workspaceId, RequestLogSearchCondition condition) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // 필수: workspaceId 필터
            predicates.add(cb.equal(root.get("workspaceId"), workspaceId));

            // 기간 필터
            if (condition.from() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), condition.from()));
            }
            if (condition.to() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), condition.to()));
            }

            // 상태 필터
            if (condition.status() != null) {
                predicates.add(cb.equal(root.get("status"), condition.status()));
            }

            // failover 필터
            if (condition.failover() != null) {
                predicates.add(cb.equal(root.get("isFailover"), condition.failover()));
            }

            // provider 필터
            if (condition.provider() != null && !condition.provider().isBlank()) {
                predicates.add(cb.equal(root.get("provider"), condition.provider()));
            }

            // usedModel 필터
            if (condition.usedModel() != null && !condition.usedModel().isBlank()) {
                predicates.add(cb.equal(root.get("usedModel"), condition.usedModel()));
            }

            // ragEnabled 필터
            if (condition.ragEnabled() != null) {
                predicates.add(cb.equal(root.get("ragEnabled"), condition.ragEnabled()));
            }

            // promptKey 필터
            if (condition.promptKey() != null && !condition.promptKey().isBlank()) {
                predicates.add(cb.equal(root.get("promptKey"), condition.promptKey()));
            }

            // traceId 필터 (정확 검색)
            if (condition.traceId() != null && !condition.traceId().isBlank()) {
                predicates.add(cb.equal(root.get("traceId"), condition.traceId()));
            }

            // errorCode 필터
            if (condition.errorCode() != null && !condition.errorCode().isBlank()) {
                predicates.add(cb.equal(root.get("errorCode"), condition.errorCode()));
            }

            // requestSource 필터
            if (condition.requestSource() != null && !condition.requestSource().isBlank()) {
                predicates.add(cb.equal(root.get("requestSource"), condition.requestSource()));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
