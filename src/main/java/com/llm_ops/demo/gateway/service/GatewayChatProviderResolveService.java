package com.llm_ops.demo.gateway.service;

import com.llm_ops.demo.gateway.dto.GatewayChatRequest;
import com.llm_ops.demo.gateway.config.GatewayPromptProviderProperties;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.keys.domain.ProviderType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.List;
/**
 * GatewayChatRequest의 promptKey를 기반으로 사용할 LLM 프로바이더를 결정하는 서비스입니다.
 * 외부 설정(GatewayPromptProviderProperties)에 정의된 매핑 정보를 활용하여 동적으로 프로바이더를 라우팅합니다.
 */
@Service
@RequiredArgsConstructor
public class GatewayChatProviderResolveService {

    private final GatewayPromptProviderProperties gatewayPromptProviderProperties;

    /**
     * GatewayChatRequest에 포함된 promptKey를 분석하여, 해당 프롬프트에 사용될 LLM 프로바이더 타입을 결정합니다.
     * `gateway.prompt-providers` 설정에 정의된 매핑 정보를 참조합니다.
     *
     * @param organizationId  요청을 보낸 조직의 ID (현재는 직접 사용되지 않으나 추후 확장성 고려)
     * @param request GatewayChatRequest 객체 (promptKey 포함)
     * @return 결정된 {@link ProviderType}
     * @throws BusinessException promptKey에 대한 프로바이더 설정이 없거나 유효하지 않을 경우
     */
    public ProviderType resolve(Long organizationId, GatewayChatRequest request) {
        List<GatewayPromptProviderProperties.PromptProviderMapping> mappings = gatewayPromptProviderProperties.promptProviders();
        if (mappings == null || mappings.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "promptKey에 대한 provider 설정이 없습니다.");
        }

        String provider = mappings.stream()
                .filter(mapping -> request.promptKey().equals(mapping.promptKey()))
                .map(GatewayPromptProviderProperties.PromptProviderMapping::provider)
                .findFirst()
                .orElse(null);
        if (provider == null || provider.isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "promptKey에 대한 provider 설정이 없습니다.");
        }
        return ProviderType.from(provider);
    }
}
