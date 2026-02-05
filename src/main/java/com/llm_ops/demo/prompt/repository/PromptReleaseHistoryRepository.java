package com.llm_ops.demo.prompt.repository;

import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.prompt.domain.PromptReleaseHistory;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PromptReleaseHistoryRepository extends JpaRepository<PromptReleaseHistory, Long> {

    List<PromptReleaseHistory> findByPromptOrderByCreatedAtDesc(Prompt prompt);
}
