package com.llm_ops.demo.prompt.repository;

import com.llm_ops.demo.prompt.domain.PromptRelease;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;

public interface PromptReleaseRepository extends JpaRepository<PromptRelease, Long> {

    Optional<PromptRelease> findByPromptId(Long promptId);

    @EntityGraph(attributePaths = {"activeVersion"})
    Optional<PromptRelease> findWithActiveVersionByPromptId(Long promptId);
}
