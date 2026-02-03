package com.llm_ops.demo.gateway.log.repository;

import com.llm_ops.demo.gateway.log.domain.RequestLog;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface RequestLogRepository extends JpaRepository<RequestLog, UUID>, JpaSpecificationExecutor<RequestLog> {
    Optional<RequestLog> findByTraceId(String traceId);

    Optional<RequestLog> findByWorkspaceIdAndTraceId(Long workspaceId, String traceId);
}
