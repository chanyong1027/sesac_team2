package com.llm_ops.demo.keys.controller;

import com.llm_ops.demo.keys.dto.ProviderCredentialCreateRequest;
import com.llm_ops.demo.keys.dto.ProviderCredentialCreateResponse;
import com.llm_ops.demo.keys.dto.ProviderCredentialSummaryResponse;
import com.llm_ops.demo.keys.dto.ProviderCredentialUpdateRequest;
import com.llm_ops.demo.keys.service.ProviderCredentialService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/organizations/{orgId}/credentials")
@RequiredArgsConstructor
public class ProviderCredentialController {

    private final ProviderCredentialService providerCredentialService;

    @PostMapping
    public ResponseEntity<ProviderCredentialCreateResponse> create(
            @PathVariable("orgId") Long organizationId,
            @Valid @RequestBody ProviderCredentialCreateRequest request
    ) {
        ProviderCredentialCreateResponse response =
                providerCredentialService.register(organizationId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<ProviderCredentialSummaryResponse>> getProviderCredentials(
            @PathVariable("orgId") Long organizationId
    ) {
        return ResponseEntity.ok(
                providerCredentialService.getProviderCredentials(organizationId)
        );
    }

    @PutMapping("/{credentialId}")
    public ResponseEntity<ProviderCredentialCreateResponse> update(
            @PathVariable("orgId") Long organizationId,
            @PathVariable Long credentialId,
            @Valid @RequestBody ProviderCredentialUpdateRequest request
    ) {
        ProviderCredentialCreateResponse response =
                providerCredentialService.update(organizationId, credentialId, request);
        return ResponseEntity.ok(response);
    }
}
