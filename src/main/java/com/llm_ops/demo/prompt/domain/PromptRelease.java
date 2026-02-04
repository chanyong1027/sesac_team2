package com.llm_ops.demo.prompt.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Transient;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.domain.Persistable;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "prompt_releases")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PromptRelease implements Persistable<Long> {

    @Id
    @Column(name = "prompt_id")
    private Long promptId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "prompt_id")
    private Prompt prompt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "active_version_id", nullable = false)
    private PromptVersion activeVersion;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Transient
    private boolean isNew = true;

    public PromptVersion getActiveVersion() {
        return activeVersion;
    }

    public Prompt getPrompt() {
        return prompt;
    }

    public static PromptRelease create(Prompt prompt, PromptVersion activeVersion) {
        if (prompt == null || activeVersion == null) {
            throw new IllegalArgumentException("Prompt와 ActiveVersion은 필수입니다.");
        }

        PromptRelease release = new PromptRelease();
        release.prompt = prompt;
        release.promptId = prompt.getId();
        release.activeVersion = activeVersion;
        release.isNew = true;
        return release;
    }

    public void changeActiveVersion(PromptVersion newVersion) {
        if (newVersion == null) {
            throw new IllegalArgumentException("새로운 버전이 null일 수 없습니다.");
        }

        this.activeVersion = newVersion;
    }

    @Override
    public Long getId() {
        return promptId;
    }

    @Override
    public boolean isNew() {
        return isNew;
    }

    @PostLoad
    @PostPersist
    private void markNotNew() {
        this.isNew = false;
    }
}
