package com.llm_ops.demo.prompt.repository;

import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.prompt.domain.PromptVersion;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PromptVersionRepository extends JpaRepository<PromptVersion, Long> {

    /**
 * Retrieve all versions for the given Prompt, ordered by version number from highest to lowest.
 *
 * @param prompt the Prompt whose versions to retrieve
 * @return a list of PromptVersion objects ordered by `versionNo` descending; empty if no versions exist
 */
List<PromptVersion> findByPromptOrderByVersionNoDesc(Prompt prompt);

    /**
 * Retrieves the PromptVersion for the given prompt with the specified version number.
 *
 * @param prompt    the Prompt owning the version
 * @param versionNo the version number to look up
 * @return an Optional containing the matching PromptVersion, or empty if none exists
 */
Optional<PromptVersion> findByPromptAndVersionNo(Prompt prompt, Integer versionNo);

    /**
     * Retrieve the highest version number for the given prompt.
     *
     * @param prompt the Prompt whose versions to inspect
     * @return the highest versionNo for the prompt, or 0 if no versions exist
     */
    @Query("SELECT COALESCE(MAX(pv.versionNo), 0) FROM PromptVersion pv WHERE pv.prompt = :prompt")
    Integer findMaxVersionNo(@Param("prompt") Prompt prompt);

    /**
 * Checks whether a PromptVersion with the given id exists for the specified Prompt.
 *
 * @param prompt    the Prompt to which the version would belong
 * @param versionId the id of the PromptVersion to check
 * @return {@code true} if a PromptVersion with the specified id exists for the prompt, {@code false} otherwise
 */
boolean existsByPromptAndId(Prompt prompt, Long versionId);
}