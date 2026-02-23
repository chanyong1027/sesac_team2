package com.llm_ops.demo.eval.repository;

import com.llm_ops.demo.eval.domain.PromptEvalDefault;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PromptEvalDefaultRepository extends JpaRepository<PromptEvalDefault, Long> {

    Optional<PromptEvalDefault> findByPromptId(Long promptId);
}
