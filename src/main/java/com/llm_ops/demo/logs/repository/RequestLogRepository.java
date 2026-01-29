package com.llm_ops.demo.logs.repository;

import com.llm_ops.demo.logs.domain.RequestLog;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * RequestLog 엔티티에 대한 데이터 접근 레이어.
 */
public interface RequestLogRepository extends JpaRepository<RequestLog, Long> {

    // 추후 필요에 따라 쿼리 메소드 추가 예정
    // 예: List<RequestLog> findByWorkspaceIdAndCreatedAtBetween(Long workspaceId,
    // LocalDateTime start, LocalDateTime end);
}
