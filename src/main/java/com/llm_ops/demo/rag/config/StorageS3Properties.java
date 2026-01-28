package com.llm_ops.demo.rag.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * S3 스토리지 설정을 외부 프로퍼티로부터 바인딩합니다.
 */
@Component
@ConfigurationProperties(prefix = "storage.s3")
@Getter
@Setter
public class StorageS3Properties {

    /**
     * S3 사용 여부입니다.
     */
    private boolean enabled = false;

    /**
     * S3 버킷 이름입니다.
     */
    private String bucket;

    /**
     * AWS 리전입니다.
     */
    private String region = "us-east-1";

    /**
     * S3 엔드포인트(로컬 MinIO 등). 비어 있으면 AWS 기본 엔드포인트를 사용합니다.
     */
    private String endpoint;

    /**
     * Path-style 접근 사용 여부입니다.
     */
    private boolean pathStyleAccess = false;

    /**
     * 액세스 키 (로컬/수동 자격 증명용).
     */
    private String accessKey;

    /**
     * 시크릿 키 (로컬/수동 자격 증명용).
     */
    private String secretKey;
}
