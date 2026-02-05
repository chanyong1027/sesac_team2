package com.llm_ops.demo.keys.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.keys.domain.OrganizationApiKey;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateRequest;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateResponse;
import com.llm_ops.demo.keys.repository.OrganizationApiKeyRepository;
import com.llm_ops.demo.keys.util.ApiKeyGenerator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@link OrganizationApiKey}를 생성하는 비즈니스 로직을 담당하는 서비스 클래스입니다.
 * '단일 책임 원칙'에 따라 키 생성과 관련된 모든 처리를 담당합니다.
 */
@Service
@RequiredArgsConstructor
public class OrganizationApiKeyCreateService {

    private final OrganizationApiKeyRepository organizationApiKeyRepository;
    private final ApiKeyGenerator apiKeyGenerator;

    /**
     * 새로운 조직 API 키를 생성하고 데이터베이스에 저장합니다.
     * 생성된 키의 실제 값은 이 메서드의 반환 값에서만 한 번 노출됩니다.
     *
     * @param organizationId API 키를 생성할 조직의 ID
     * @param request        API 키 생성 요청 정보
     * @return 생성된 API 키의 실제 값이 포함된 응답 DTO
     */
    @Transactional
    public OrganizationApiKeyCreateResponse create(Long organizationId, OrganizationApiKeyCreateRequest request) {
        validateNameUnique(organizationId, request.name());

        ApiKeyGenerator.GeneratedKey generatedKey = apiKeyGenerator.generateWithHash();

        organizationApiKeyRepository.save(
                OrganizationApiKey.create(
                        organizationId,
                        request.name(),
                        generatedKey.hash(),
                        generatedKey.prefix()
                )
        );

        return new OrganizationApiKeyCreateResponse(generatedKey.plaintext());
    }

    /**
     * 조직 내에서 API 키의 이름이 고유한지 검증합니다.
     */
    private void validateNameUnique(Long organizationId, String name) {
        if (organizationApiKeyRepository.existsByOrganizationIdAndName(organizationId, name)) {
            throw new BusinessException(ErrorCode.CONFLICT, "이미 존재하는 API Key 이름입니다.");
        }
    }
}
