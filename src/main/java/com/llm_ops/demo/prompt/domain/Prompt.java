package com.llm_ops.demo.prompt.domain;

import com.llm_ops.demo.workspace.domain.Workspace;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "prompts",
       uniqueConstraints = @UniqueConstraint(
           name = "uq_prompts_workspace_prompt_key",
           columnNames = {"workspace_id", "prompt_key"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Prompt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workspace_id", nullable = false)
    private Workspace workspace;

    @Column(name = "prompt_key", nullable = false, length = 100)
    private String promptKey;

    @Column(length = 500)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PromptStatus status;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    public static Prompt create(Workspace workspace, String promptKey, String description) {
        Prompt prompt = new Prompt();
        prompt.workspace = workspace;
        prompt.promptKey = promptKey;
        prompt.description = description;
        prompt.status = PromptStatus.ACTIVE;
        return prompt;
    }

    public void update(String promptKey, String description) {
        if (promptKey != null && !promptKey.isBlank()) {
            this.promptKey = promptKey;
        }
        if (description != null) {
            this.description = description;
        }
    }

    public void archive() {
        this.status = PromptStatus.ARCHIVED;
    }

    public boolean isActive() {
        return this.status == PromptStatus.ACTIVE;
    }
}
