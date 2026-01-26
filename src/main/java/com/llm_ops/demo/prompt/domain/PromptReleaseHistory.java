package com.llm_ops.demo.prompt.domain;

import com.llm_ops.demo.auth.domain.User;
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
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "prompt_release_histories")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PromptReleaseHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prompt_id", nullable = false)
    private Prompt prompt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "from_version_id")
    private PromptVersion fromVersion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "to_version_id", nullable = false)
    private PromptVersion toVersion;

    @Enumerated(EnumType.STRING)
    @Column(name = "change_type", nullable = false, length = 20)
    private ChangeType changeType;

    @Column(length = 500)
    private String reason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "changed_by", nullable = false)
    private User changedBy;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public static PromptReleaseHistory create(
            Prompt prompt,
            PromptVersion fromVersion,
            PromptVersion toVersion,
            ChangeType changeType,
            String reason,
            User changedBy
    ) {
        PromptReleaseHistory history = new PromptReleaseHistory();
        history.prompt = prompt;
        history.fromVersion = fromVersion;
        history.toVersion = toVersion;
        history.changeType = changeType;
        history.reason = reason;
        history.changedBy = changedBy;
        return history;
    }
}
