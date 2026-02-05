package com.llm_ops.demo.rag.storage;

import com.llm_ops.demo.rag.config.StorageS3Properties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("local")
@EnabledIfEnvironmentVariable(named = "RUN_MINIO_TESTS", matches = "true")
class S3ApiClientIT {

    @Autowired
    private S3ApiClient s3ApiClient;

    @Autowired
    private S3Client s3Client;

    @Autowired
    private StorageS3Properties properties;

    @Test
    void 문서를_업로드하고_존재_여부를_확인한다() {
        // given
        byte[] payload = "hello minio".getBytes(StandardCharsets.UTF_8);
        ByteArrayInputStream inputStream = new ByteArrayInputStream(payload);

        // when
        String key = s3ApiClient.uploadDocument(
                1L,
                "sample.txt",
                inputStream,
                payload.length,
                "text/plain",
                Map.of("source", "local-test")
        );

        // then
        assertThat(key).isNotBlank();
        s3Client.headObject(HeadObjectRequest.builder()
                .bucket(properties.getBucket())
                .key(key)
                .build());

        // cleanup
        s3Client.deleteObject(DeleteObjectRequest.builder()
                .bucket(properties.getBucket())
                .key(key)
                .build());
    }
}
