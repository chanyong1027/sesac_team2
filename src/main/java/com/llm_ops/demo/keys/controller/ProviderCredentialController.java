package com.llm_ops.demo.keys.controller;

import com.llm_ops.demo.keys.dto.ProviderCredentialCreateRequest;
import com.llm_ops.demo.keys.dto.ProviderCredentialCreateResponse;
import com.llm_ops.demo.keys.service.ProviderCredentialService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/organizations/{orgId}/credentials")
@RequiredArgsConstructor
public class ProviderCredentialController {

    private final ProviderCredentialService providerCredentialService;

    @PostMapping
    public ResponseEntity<ProviderCredentialCreateResponse> create(
            @PathVariable Long orgId,
            @Valid @RequestBody ProviderCredentialCreateRequest request
    ) {
        ProviderCredentialCreateResponse response =
                providerCredentialService.register(orgId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
