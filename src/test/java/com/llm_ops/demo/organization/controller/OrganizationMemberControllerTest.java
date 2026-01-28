package com.llm_ops.demo.organization.controller;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.llm_ops.demo.config.TestSecurityConfig;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.organization.domain.OrganizationRole;
import com.llm_ops.demo.organization.dto.OrganizationMemberRemoveResponse;
import com.llm_ops.demo.organization.dto.OrganizationMemberResponse;
import com.llm_ops.demo.organization.service.OrganizationMemberService;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(OrganizationMemberController.class)
@AutoConfigureMockMvc
@ActiveProfiles({"test", "mock-auth"})
@Import(TestSecurityConfig.class)
class OrganizationMemberControllerTest {

        @Autowired
        private MockMvc mockMvc;

        @MockitoBean
        private OrganizationMemberService organizationMemberService;

        private Authentication createAuth(Long userId) {
                return new UsernamePasswordAuthenticationToken(userId, null, List.of());
        }

        @Nested
        @DisplayName("멤버 목록 조회 API")
        class GetMembersApi {

                @Test
                @DisplayName("멤버 목록 조회 성공")
                void getMembers_Success() throws Exception {
                        // given
                        Long organizationId = 1L;
                        Long userId = 1L;

                        List<OrganizationMemberResponse> response = List.of(
                                        new OrganizationMemberResponse(1L, 1L, "owner@example.com", "오너",
                                                        OrganizationRole.OWNER,
                                                        "ACTIVATE", LocalDateTime.now()),
                                        new OrganizationMemberResponse(2L, 2L, "admin@example.com", "관리자",
                                                        OrganizationRole.ADMIN,
                                                        "ACTIVATE", LocalDateTime.now()),
                                        new OrganizationMemberResponse(3L, 3L, "member@example.com", "멤버",
                                                        OrganizationRole.MEMBER,
                                                        "ACTIVATE", LocalDateTime.now()));

                        given(organizationMemberService.getMembers(eq(organizationId), eq(userId)))
                                        .willReturn(response);

                        // when & then
                        mockMvc.perform(get("/api/v1/organizations/{organizationId}/members", organizationId)
                                        .with(authentication(createAuth(userId))))
                                        .andExpect(status().isOk())
                                        .andExpect(jsonPath("$").isArray())
                                        .andExpect(jsonPath("$.length()").value(3))
                                        .andExpect(jsonPath("$[0].memberId").value(1L))
                                        .andExpect(jsonPath("$[0].email").value("owner@example.com"))
                                        .andExpect(jsonPath("$[0].role").value("OWNER"));
                }

                @Test
                @DisplayName("조직 멤버가 아닌 경우 403 반환")
                void getMembers_NotMember_Returns403() throws Exception {
                        // given
                        Long organizationId = 1L;
                        Long userId = 99L;

                        willThrow(new BusinessException(ErrorCode.FORBIDDEN))
                                        .given(organizationMemberService)
                                        .getMembers(eq(organizationId), eq(userId));

                        // when & then
                        mockMvc.perform(get("/api/v1/organizations/{organizationId}/members", organizationId)
                                        .with(authentication(createAuth(userId))))
                                        .andDo(print())
                                        .andExpect(status().isForbidden());
                }
        }

        @Nested
        @DisplayName("멤버 퇴출 API")
        class RemoveMemberApi {

                @Test
                @DisplayName("멤버 퇴출 성공")
                void removeMember_Success() throws Exception {
                        // given
                        Long organizationId = 1L;
                        Long memberId = 3L;
                        Long userId = 1L;

                        OrganizationMemberRemoveResponse response = new OrganizationMemberRemoveResponse(memberId,
                                        LocalDateTime.now());

                        given(organizationMemberService.removeMember(eq(organizationId), eq(memberId), eq(userId)))
                                        .willReturn(response);

                        // when & then
                        mockMvc.perform(
                                        delete("/api/v1/organizations/{organizationId}/members/{memberId}",
                                                        organizationId, memberId)
                                                        .with(authentication(createAuth(userId))))
                                        .andExpect(status().isOk())
                                        .andExpect(jsonPath("$.memberId").value(memberId))
                                        .andExpect(jsonPath("$.removedAt").exists());
                }

                @Test
                @DisplayName("권한 없는 사용자가 퇴출 시도 시 403 반환")
                void removeMember_NoPermission_Returns403() throws Exception {
                        // given
                        Long organizationId = 1L;
                        Long memberId = 3L;
                        Long userId = 5L;

                        willThrow(new BusinessException(ErrorCode.FORBIDDEN))
                                        .given(organizationMemberService)
                                        .removeMember(eq(organizationId), eq(memberId), eq(userId));

                        // when & then
                        mockMvc.perform(
                                        delete("/api/v1/organizations/{organizationId}/members/{memberId}",
                                                        organizationId, memberId)
                                                        .with(authentication(createAuth(userId))))
                                        .andDo(print())
                                        .andExpect(status().isForbidden());
                }

                @Test
                @DisplayName("OWNER 퇴출 시도 시 400 반환")
                void removeMember_OwnerTarget_Returns400() throws Exception {
                        // given
                        Long organizationId = 1L;
                        Long memberId = 1L;
                        Long userId = 2L;

                        willThrow(new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "OWNER는 퇴출할 수 없습니다."))
                                        .given(organizationMemberService)
                                        .removeMember(eq(organizationId), eq(memberId), eq(userId));

                        // when & then
                        mockMvc.perform(
                                        delete("/api/v1/organizations/{organizationId}/members/{memberId}",
                                                        organizationId, memberId)
                                                        .with(authentication(createAuth(userId))))
                                        .andDo(print())
                                        .andExpect(status().isBadRequest());
                }

                @Test
                @DisplayName("본인 퇴출 시도 시 400 반환")
                void removeMember_Self_Returns400() throws Exception {
                        // given
                        Long organizationId = 1L;
                        Long memberId = 2L;
                        Long userId = 2L;

                        willThrow(new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "본인은 퇴출할 수 없습니다."))
                                        .given(organizationMemberService)
                                        .removeMember(eq(organizationId), eq(memberId), eq(userId));

                        // when & then
                        mockMvc.perform(
                                        delete("/api/v1/organizations/{organizationId}/members/{memberId}",
                                                        organizationId, memberId)
                                                        .with(authentication(createAuth(userId))))
                                        .andDo(print())
                                        .andExpect(status().isBadRequest());
                }
        }

}
