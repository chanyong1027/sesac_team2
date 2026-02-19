package com.llm_ops.demo.eval.repository;

import com.llm_ops.demo.eval.domain.EvalTestCase;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EvalTestCaseRepository extends JpaRepository<EvalTestCase, Long> {

    List<EvalTestCase> findByDatasetIdOrderByCaseOrderAsc(Long datasetId);

    List<EvalTestCase> findByDatasetIdAndEnabledTrueOrderByCaseOrderAsc(Long datasetId);

    long countByDatasetIdAndEnabledTrue(Long datasetId);

    void deleteByDatasetId(Long datasetId);

    @Query("SELECT COALESCE(MAX(tc.caseOrder), 0) FROM EvalTestCase tc WHERE tc.dataset.id = :datasetId")
    Integer findMaxCaseOrder(@Param("datasetId") Long datasetId);

    Optional<EvalTestCase> findByIdAndDatasetId(Long id, Long datasetId);
}
