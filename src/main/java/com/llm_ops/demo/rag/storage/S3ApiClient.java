package com.llm_ops.demo.rag.storage;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.rag.config.StorageS3Properties;
import java.io.InputStream;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

/**
 * S3 업로드 전용 API 클라이언트입니다.
 */
@Component
@ConditionalOnBean(S3Client.class)
public class S3ApiClient {

    private static final Logger log = LoggerFactory.getLogger(S3ApiClient.class);

    private final S3Client s3Client;
    private final StorageS3Properties properties;
    private final S3KeyGenerator keyGenerator;

    public S3ApiClient(S3Client s3Client, StorageS3Properties properties, S3KeyGenerator keyGenerator) {
        this.s3Client = s3Client;
        this.properties = properties;
        this.keyGenerator = keyGenerator;
    }

    public String uploadDocument(Long workspaceId,
                                 String originalFilename,
                                 InputStream inputStream,
                                 long contentLength,
                                 String contentType,
                                 Map<String, String> metadata) {
        String key = keyGenerator.generateDocumentKey(workspaceId, originalFilename);
        PutObjectRequest.Builder requestBuilder = PutObjectRequest.builder()
                .bucket(properties.getBucket())
                .key(key);
        if (contentType != null && !contentType.isBlank()) {
            requestBuilder.contentType(contentType);
        }
        if (metadata != null && !metadata.isEmpty()) {
            requestBuilder.metadata(metadata);
        }

        try {
            s3Client.putObject(requestBuilder.build(), RequestBody.fromInputStream(inputStream, contentLength));
            return key;
        } catch (Exception ex) {
            log.error("S3 upload failed. workspaceId={}, key={}, size={}", workspaceId, key, contentLength, ex);
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "S3 업로드에 실패했습니다.");
        }
    }

    public void deleteDocument(String key) {
        if (key == null || key.isBlank()) {
            return;
        }
        DeleteObjectRequest request = DeleteObjectRequest.builder()
                .bucket(properties.getBucket())
                .key(key)
                .build();
        s3Client.deleteObject(request);
    }
}
