package com.llm_ops.demo.keys.controller;

import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateRequest;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateResponse;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyRotateRequest;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyRotateResponse;
import com.llm_ops.demo.keys.dto.OrganizationApiKeySummaryResponse;
import com.llm_ops.demo.keys.service.OrganizationApiKeyCreateService;
import com.llm_ops.demo.keys.service.OrganizationApiKeyQueryService;
import com.llm_ops.demo.keys.service.OrganizationApiKeyRotateService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 조직(Organization)의 API 키 발급 및 관리를 위한 컨트롤러입니다.
 * 외부 서비스가 LuminaOps에 접근할 때 사용하는 전용 API 키에 대한 CRUD 연산을 처리합니다.
 */
@RestController
@RequestMapping("/api/v1/organizations/{orgId}/api-keys")
@RequiredArgsConstructor
public class OrganizationApiKeyController {

    private final OrganizationApiKeyCreateService organizationApiKeyCreateService;
    private final OrganizationApiKeyQueryService organizationApiKeyQueryService;
    private final OrganizationApiKeyRotateService organizationApiKeyRotateService;

    /**
     * 지정된 조직에 대한 신규 API 키를 발급합니다.
     * 키의 실제 값(raw key)은 이 응답에서만 한 번만 노출됩니다.
     *
     * @param organizationId API 키를 발급할 조직의 ID
     * @param request        API 키 생성 요청 DTO
     * @return 생성된 API 키 정보 (키 값 포함)
     */
    @PostMapping
    public ResponseEntity<OrganizationApiKeyCreateResponse> create(
            @PathVariable("orgId") Long organizationId,
            @Valid @RequestBody OrganizationApiKeyCreateRequest request
    ) {
        OrganizationApiKeyCreateResponse response = organizationApiKeyCreateService.create(organizationId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * 지정된 조직에 발급된 모든 API 키의 요약 목록을 조회합니다.
     * 보안을 위해 키의 실제 값이 아닌, 접두사(prefix)와 같은 요약 정보만 반환합니다.
     *
     * @param organizationId API 키 목록을 조회할 조직의 ID
     * @return 해당 조직의 API 키 요약 정보 리스트
     */
    @GetMapping
    public ResponseEntity<List<OrganizationApiKeySummaryResponse>> getOrganizationApiKeys(
            @PathVariable("orgId") Long organizationId
    ) {
        return ResponseEntity.ok(organizationApiKeyQueryService.getOrganizationApiKeys(organizationId));
    }

    /**
     * 지정된 API 키를 새로운 값으로 교체(Rotate)합니다.
     * 기존 키는 더 이상 유효하지 않게 되며, 새로운 키의 실제 값은 이 응답에서만 한 번 노출됩니다.
     *
     * @param organizationId API 키가 속한 조직의 ID
     * @param keyId          교체할 API 키의 ID
     * @param request        교체 요청 DTO (사유 포함)
     * @return 새로운 API 키 정보
     */
    @PostMapping("/{keyId}/rotate")
    public ResponseEntity<OrganizationApiKeyRotateResponse> rotate(
            @PathVariable("orgId") Long organizationId,
            @PathVariable("keyId") Long keyId,
            @Valid @RequestBody OrganizationApiKeyRotateRequest request
    ) {
        OrganizationApiKeyRotateResponse response =
                organizationApiKeyRotateService.rotate(organizationId, keyId, request);
        return ResponseEntity.ok(response);
    }
}
