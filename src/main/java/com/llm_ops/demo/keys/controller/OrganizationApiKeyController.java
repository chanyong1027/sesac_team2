package com.llm_ops.demo.keys.controller;

import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateRequest;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateResponse;
import com.llm_ops.demo.keys.dto.OrganizationApiKeySummaryResponse;
import com.llm_ops.demo.keys.service.OrganizationApiKeyCreateService;
import com.llm_ops.demo.keys.service.OrganizationApiKeyQueryService;
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

@RestController
@RequestMapping("/api/v1/organizations/{orgId}/api-keys")
@RequiredArgsConstructor
public class OrganizationApiKeyController {

    private final OrganizationApiKeyCreateService organizationApiKeyCreateService;
    private final OrganizationApiKeyQueryService organizationApiKeyQueryService;

    @PostMapping
    public ResponseEntity<OrganizationApiKeyCreateResponse> create(
            @PathVariable Long orgId,
            @Valid @RequestBody OrganizationApiKeyCreateRequest request
    ) {
        OrganizationApiKeyCreateResponse response = organizationApiKeyCreateService.create(orgId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<OrganizationApiKeySummaryResponse>> getOrganizationApiKeys(
            @PathVariable Long orgId
    ) {
        return ResponseEntity.ok(organizationApiKeyQueryService.getOrganizationApiKeys(orgId));
    }
}

