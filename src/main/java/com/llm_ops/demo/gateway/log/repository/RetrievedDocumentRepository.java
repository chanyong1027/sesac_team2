package com.llm_ops.demo.gateway.log.repository;

import com.llm_ops.demo.gateway.log.domain.RetrievedDocument;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RetrievedDocumentRepository extends JpaRepository<RetrievedDocument, Long> {
}
