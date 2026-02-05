package com.llm_ops.demo.organization.controller;

import com.llm_ops.demo.organization.dto.OrganizationMemberRemoveResponse;
import com.llm_ops.demo.organization.dto.OrganizationMemberResponse;
import com.llm_ops.demo.organization.dto.OrganizationMemberRoleUpdateRequest;
import com.llm_ops.demo.organization.dto.OrganizationMemberRoleUpdateResponse;
import com.llm_ops.demo.organization.service.OrganizationMemberService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/organizations/{organizationId}/members")
@RequiredArgsConstructor
public class OrganizationMemberController {

    private final OrganizationMemberService organizationMemberService;

    @GetMapping
    public ResponseEntity<List<OrganizationMemberResponse>> getMembers(
        @PathVariable Long organizationId,
        @AuthenticationPrincipal Long userId
    ) {
        List<OrganizationMemberResponse> response =
            organizationMemberService.getMembers(organizationId, userId);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{memberId}")
    public ResponseEntity<OrganizationMemberRoleUpdateResponse> updateMemberRole(
            @PathVariable Long organizationId,
            @PathVariable Long memberId,
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody OrganizationMemberRoleUpdateRequest request
    ) {
        OrganizationMemberRoleUpdateResponse response =
                organizationMemberService.updateMemberRole(organizationId, memberId, userId, request);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{memberId}")
    public ResponseEntity<OrganizationMemberRemoveResponse> removeMember(
        @PathVariable Long organizationId,
        @PathVariable Long memberId,
        @AuthenticationPrincipal Long userId
    ) {
        OrganizationMemberRemoveResponse response =
            organizationMemberService.removeMember(organizationId, memberId, userId);
        return ResponseEntity.ok(response);
    }
}
