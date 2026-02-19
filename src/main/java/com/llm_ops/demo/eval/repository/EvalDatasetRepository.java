package com.llm_ops.demo.eval.repository;

import com.llm_ops.demo.eval.domain.EvalDataset;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EvalDatasetRepository extends JpaRepository<EvalDataset, Long> {

    List<EvalDataset> findByWorkspaceIdOrderByCreatedAtDesc(Long workspaceId);

    Optional<EvalDataset> findByIdAndWorkspaceId(Long id, Long workspaceId);
}
