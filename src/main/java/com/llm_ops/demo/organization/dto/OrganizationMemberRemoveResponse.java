package com.llm_ops.demo.organization.dto;

import java.time.LocalDateTime;

/**
 * 조직 멤버 퇴출 응답 DTO
 *
 * @param memberId 퇴출된 멤버 ID
 * @param removedAt 퇴출 일시
 */
public record OrganizationMemberRemoveResponse(
    Long memberId,
    LocalDateTime removedAt
) {
    /**
     * 정적 팩토리 메서드
     *
     * @param memberId 퇴출된 멤버 ID
     * @return 응답 DTO
     */
    public static OrganizationMemberRemoveResponse of(Long memberId) {
        return new OrganizationMemberRemoveResponse(memberId, LocalDateTime.now());
    }
}
