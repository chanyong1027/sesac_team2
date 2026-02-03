package com.llm_ops.demo.keys.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.keys.domain.OrganizationApiKey;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyRotateRequest;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyRotateResponse;
import com.llm_ops.demo.keys.repository.OrganizationApiKeyRepository;
import com.llm_ops.demo.keys.util.ApiKeyGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * {@link OrganizationApiKey}를 교체(Rotate)하는 비즈니스 로직을 담당하는 서비스 클래스입니다.
 * 기존 키를 폐기하고 새로운 키를 발급하는 In-place 방식으로 동작합니다.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OrganizationApiKeyRotateService {

    private final OrganizationApiKeyRepository organizationApiKeyRepository;
    private final ApiKeyGenerator apiKeyGenerator;

    /**
     * 지정된 API 키를 새로운 값으로 교체(Rotate)합니다.
     * 기존 키는 더 이상 유효하지 않게 되며, 새로운 키의 원문은 이 메서드의 반환 값에서만 한 번 노출됩니다.
     *
     * @param organizationId 조직 ID
     * @param keyId          교체할 API 키 ID
     * @param request        교체 요청 (사유 포함)
     * @return 새로운 API 키 원문이 포함된 응답
     */
    @Transactional
    public OrganizationApiKeyRotateResponse rotate(
            Long organizationId,
            Long keyId,
            OrganizationApiKeyRotateRequest request
    ) {
        OrganizationApiKey apiKey = findAndValidateKey(organizationId, keyId);

        ApiKeyGenerator.GeneratedKey generatedKey = apiKeyGenerator.generateWithHash();

        apiKey.rotate(generatedKey.hash(), generatedKey.prefix());

        log.info("API Key rotated: keyId={}, orgId={}, reason={}",
                keyId, organizationId, request.reason());

        return new OrganizationApiKeyRotateResponse(
                generatedKey.plaintext(),
                LocalDateTime.now()
        );
    }

    private OrganizationApiKey findAndValidateKey(Long organizationId, Long keyId) {
        OrganizationApiKey apiKey = organizationApiKeyRepository.findById(keyId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "API Key를 찾을 수 없습니다."));

        if (!apiKey.getOrganizationId().equals(organizationId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "해당 조직의 API Key가 아닙니다.");
        }

        if (!apiKey.isActive()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "비활성화된 API Key는 교체할 수 없습니다.");
        }

        return apiKey;
    }
}
