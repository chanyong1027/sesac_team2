package com.llm_ops.demo.eval.repository;

import com.llm_ops.demo.eval.domain.PromptEvalDefaultDraft;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PromptEvalDefaultDraftRepository extends JpaRepository<PromptEvalDefaultDraft, Long> {

    Optional<PromptEvalDefaultDraft> findByPromptId(Long promptId);

    void deleteByPromptId(Long promptId);
}
