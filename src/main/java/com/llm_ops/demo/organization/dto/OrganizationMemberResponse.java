package com.llm_ops.demo.organization.dto;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.organization.domain.OrganizationMember;
import com.llm_ops.demo.organization.domain.OrganizationRole;
import java.time.LocalDateTime;
import java.util.Objects;

/**
 * 조직 멤버 조회 응답 DTO
 *
 * @param memberId 멤버 ID
 * @param userId 사용자 ID
 * @param email 사용자 이메일
 * @param name 사용자 이름
 * @param role 조직 내 역할
 * @param status 사용자 상태
 * @param joinedAt 가입 일시
 */
public record OrganizationMemberResponse(
    Long memberId,
    Long userId,
    String email,
    String name,
    OrganizationRole role,
    String status,
    LocalDateTime joinedAt
) {
    /**
     * 정적 팩토리 메서드
     *
     * @param member 조직 멤버 엔티티 (user가 로드되어 있어야 함)
     * @return 응답 DTO
     * @throws NullPointerException member 또는 user가 null인 경우
     */
    public static OrganizationMemberResponse from(OrganizationMember member) {
        Objects.requireNonNull(member, "OrganizationMember must not be null");

        User user = member.getUser();
        Objects.requireNonNull(user, "User must not be null (JOIN FETCH 누락 가능성)");

        return new OrganizationMemberResponse(
            member.getId(),
            user.getId(),
            user.getEmail(),
            user.getName(),
            member.getRole(),
            user.getStatus().name(),
            member.getJoinedAt()
        );
    }
}
