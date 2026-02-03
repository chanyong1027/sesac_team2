package com.llm_ops.demo.workspace.repository;

import com.llm_ops.demo.workspace.domain.WorkspaceRagSettings;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkspaceRagSettingsRepository extends JpaRepository<WorkspaceRagSettings, Long> {

    Optional<WorkspaceRagSettings> findByWorkspaceId(Long workspaceId);
}
