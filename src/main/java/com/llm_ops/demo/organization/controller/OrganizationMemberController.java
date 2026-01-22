package com.llm_ops.demo.organization.controller;

import com.llm_ops.demo.organization.dto.OrganizationMemberRemoveResponse;
import com.llm_ops.demo.organization.dto.OrganizationMemberResponse;
import com.llm_ops.demo.organization.service.OrganizationMemberService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
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
        @RequestHeader("X-User-Id") Long userId
    ) {
        List<OrganizationMemberResponse> response =
            organizationMemberService.getMembers(organizationId, userId);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{memberId}")
    public ResponseEntity<OrganizationMemberRemoveResponse> removeMember(
        @PathVariable Long organizationId,
        @PathVariable Long memberId,
        @RequestHeader("X-User-Id") Long userId
    ) {
        OrganizationMemberRemoveResponse response =
            organizationMemberService.removeMember(organizationId, memberId, userId);
        return ResponseEntity.ok(response);
    }
}
