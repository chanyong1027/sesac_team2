package com.llm_ops.demo.organization.controller;

import com.llm_ops.demo.organization.dto.OrganizationCreateRequest;
import com.llm_ops.demo.organization.dto.OrganizationCreateResponse;
import com.llm_ops.demo.organization.service.OrganizationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/organizations")
@RequiredArgsConstructor
public class OrganizationController {

    private final OrganizationService organizationService;

    @PostMapping
    public ResponseEntity<OrganizationCreateResponse> createOrganization(
        @RequestHeader("X-User-Id") Long userId,
        @Valid @RequestBody OrganizationCreateRequest request
    ) {
        OrganizationCreateResponse response = organizationService.create(userId, request);
        return ResponseEntity.ok(response);
    }
}
