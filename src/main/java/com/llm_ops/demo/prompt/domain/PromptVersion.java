package com.llm_ops.demo.prompt.domain;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.keys.domain.ProviderType;
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
import java.util.Map;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "prompt_versions",
       uniqueConstraints = @UniqueConstraint(
           name = "uq_prompt_versions_prompt_version",
           columnNames = {"prompt_id", "version_no"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PromptVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prompt_id", nullable = false)
    private Prompt prompt;

    @Column(name = "version_no", nullable = false)
    private Integer versionNo;

    @Column(length = 100)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private ProviderType provider;

    @Column(nullable = false, length = 100)
    private String model;

    @Column(name = "system_prompt", columnDefinition = "TEXT")
    private String systemPrompt;

    @Column(name = "user_template", columnDefinition = "TEXT")
    private String userTemplate;

    @Column(name = "model_config")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> modelConfig;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public static PromptVersion create(
            Prompt prompt,
            Integer versionNo,
            String title,
            ProviderType provider,
            String model,
            String systemPrompt,
            String userTemplate,
            Map<String, Object> modelConfig,
            User createdBy
    ) {
        PromptVersion version = new PromptVersion();
        version.prompt = prompt;
        version.versionNo = versionNo;
        version.title = title;
        version.provider = provider;
        version.model = model;
        version.systemPrompt = systemPrompt;
        version.userTemplate = userTemplate;
        version.modelConfig = modelConfig;
        version.createdBy = createdBy;
        return version;
    }
}
