package com.llm_ops.demo.prompt.repository;

import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.prompt.domain.PromptVersion;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PromptVersionRepository extends JpaRepository<PromptVersion, Long> {

    List<PromptVersion> findByPromptOrderByVersionNoDesc(Prompt prompt);

    Optional<PromptVersion> findByPromptAndVersionNo(Prompt prompt, Integer versionNo);

    @Query("SELECT COALESCE(MAX(pv.versionNo), 0) FROM PromptVersion pv WHERE pv.prompt = :prompt")
    Integer findMaxVersionNo(@Param("prompt") Prompt prompt);

    boolean existsByPromptAndId(Prompt prompt, Long versionId);
}
