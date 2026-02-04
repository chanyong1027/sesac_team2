package com.llm_ops.demo.workspace.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.llm_ops.demo.config.TestSecurityConfig;
import com.llm_ops.demo.workspace.domain.WorkspaceRole;
import com.llm_ops.demo.workspace.domain.WorkspaceStatus;
import com.llm_ops.demo.workspace.dto.WorkspaceCreateRequest;
import com.llm_ops.demo.workspace.dto.WorkspaceCreateResponse;
import com.llm_ops.demo.workspace.dto.WorkspaceDeleteResponse;
import com.llm_ops.demo.workspace.dto.WorkspaceSummaryResponse;
import com.llm_ops.demo.workspace.dto.WorkspaceUpdateRequest;
import com.llm_ops.demo.workspace.dto.WorkspaceUpdateResponse;
import com.llm_ops.demo.workspace.service.WorkspaceListService;
import com.llm_ops.demo.workspace.service.WorkspaceService;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(WorkspaceController.class)
@AutoConfigureMockMvc
@ActiveProfiles({"test", "mock-auth"})
@Import(TestSecurityConfig.class)
class WorkspaceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private WorkspaceService workspaceService;

    @MockitoBean
    private WorkspaceListService workspaceListService;

    @Test
    @DisplayName("워크스페이스 생성 API 성공")
    void createWorkspace_Success() throws Exception {
        // given
        Long orgId = 1L;
        Long userId = 1L;
        WorkspaceCreateRequest request = new WorkspaceCreateRequest("production", "프로덕션 환경");
        WorkspaceCreateResponse response = new WorkspaceCreateResponse(
                1L,
                "production",
                "프로덕션 환경",
                WorkspaceStatus.ACTIVE);

        given(workspaceService.create(eq(orgId), eq(userId), any(WorkspaceCreateRequest.class)))
                .willReturn(response);

        // when & then
        mockMvc.perform(post("/api/v1/organizations/{orgId}/workspaces", orgId)
                .header("X-User-Id", userId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1L))
                .andExpect(jsonPath("$.name").value("production"))
                .andExpect(jsonPath("$.displayName").value("프로덕션 환경"))
                .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    @DisplayName("워크스페이스 식별자 누락 시 검증 실패")
    void createWorkspace_BlankName_ValidationFails() throws Exception {
        // given
        Long orgId = 1L;
        Long userId = 1L;
        WorkspaceCreateRequest request = new WorkspaceCreateRequest("", "프로덕션 환경");

        // when & then
        mockMvc.perform(post("/api/v1/organizations/{orgId}/workspaces", orgId)
                .header("X-User-Id", userId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andDo(print())
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("워크스페이스 식별자 패턴 오류 시 검증 실패")
    void createWorkspace_InvalidNamePattern_ValidationFails() throws Exception {
        // given
        Long orgId = 1L;
        Long userId = 1L;
        WorkspaceCreateRequest request = new WorkspaceCreateRequest("Production_Test", "프로덕션 환경");

        // when & then
        mockMvc.perform(post("/api/v1/organizations/{orgId}/workspaces", orgId)
                .header("X-User-Id", userId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andDo(print())
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("워크스페이스 이름 누락 시 검증 실패")
    void createWorkspace_BlankDisplayName_ValidationFails() throws Exception {
        // given
        Long orgId = 1L;
        Long userId = 1L;
        WorkspaceCreateRequest request = new WorkspaceCreateRequest("production", "");

        // when & then
        mockMvc.perform(post("/api/v1/organizations/{orgId}/workspaces", orgId)
                .header("X-User-Id", userId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andDo(print())
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("워크스페이스 목록 조회 API 성공")
    void getMyWorkspaces_Success() throws Exception {
        // given
        Long userId = 1L;
        List<WorkspaceSummaryResponse> response = List.of(
                new WorkspaceSummaryResponse(
                        1L, 1L, "테스트 조직", "production", "프로덕션",
                        WorkspaceStatus.ACTIVE, WorkspaceRole.OWNER, LocalDateTime.now()),
                new WorkspaceSummaryResponse(
                        2L, 1L, "테스트 조직", "staging", "스테이징",
                        WorkspaceStatus.ACTIVE, WorkspaceRole.MEMBER, LocalDateTime.now()));

        given(workspaceListService.getMyWorkspaces(userId)).willReturn(response);

        // when & then
        mockMvc.perform(get("/api/v1/workspaces")
                .header("X-User-Id", userId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].name").value("production"))
                .andExpect(jsonPath("$[0].myRole").value("OWNER"))
                .andExpect(jsonPath("$[0].organizationName").value("테스트 조직"))
                .andExpect(jsonPath("$[1].name").value("staging"))
                .andExpect(jsonPath("$[1].myRole").value("MEMBER"));
    }

    @Test
    @DisplayName("워크스페이스가 없으면 빈 리스트 반환")
    void getMyWorkspaces_Empty_ReturnsEmptyList() throws Exception {
        // given
        Long userId = 1L;

        given(workspaceListService.getMyWorkspaces(userId)).willReturn(List.of());

        // when & then
        mockMvc.perform(get("/api/v1/workspaces")
                .header("X-User-Id", userId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    @DisplayName("워크스페이스 수정 API 성공")
    void updateWorkspace_Success() throws Exception {
        // given
        Long orgId = 1L;
        Long workspaceId = 1L;
        Long userId = 1L;
        WorkspaceUpdateRequest request = new WorkspaceUpdateRequest("수정된 이름");
        WorkspaceUpdateResponse response = new WorkspaceUpdateResponse(
                workspaceId, "production", "수정된 이름", WorkspaceStatus.ACTIVE);

        given(workspaceService.update(eq(orgId), eq(workspaceId), eq(userId), any(WorkspaceUpdateRequest.class)))
                .willReturn(response);

        // when & then
        mockMvc.perform(patch("/api/v1/organizations/{orgId}/workspaces/{workspaceId}", orgId, workspaceId)
                .header("X-User-Id", userId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(workspaceId))
                .andExpect(jsonPath("$.name").value("production"))
                .andExpect(jsonPath("$.displayName").value("수정된 이름"))
                .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    @DisplayName("워크스페이스 수정 시 이름 누락이면 검증 실패")
    void updateWorkspace_BlankDisplayName_ValidationFails() throws Exception {
        // given
        Long orgId = 1L;
        Long workspaceId = 1L;
        Long userId = 1L;
        WorkspaceUpdateRequest request = new WorkspaceUpdateRequest("");

        // when & then
        mockMvc.perform(patch("/api/v1/organizations/{orgId}/workspaces/{workspaceId}", orgId, workspaceId)
                .header("X-User-Id", userId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andDo(print())
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("워크스페이스 삭제 API 성공")
    void deleteWorkspace_Success() throws Exception {
        // given
        Long orgId = 1L;
        Long workspaceId = 1L;
        Long userId = 1L;
        WorkspaceDeleteResponse response = new WorkspaceDeleteResponse(workspaceId, "워크스페이스가 비활성화되었습니다.");

        given(workspaceService.delete(eq(orgId), eq(workspaceId), eq(userId)))
                .willReturn(response);

        // when & then
        mockMvc.perform(delete("/api/v1/organizations/{orgId}/workspaces/{workspaceId}", orgId, workspaceId)
                .header("X-User-Id", userId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.workspaceId").value(workspaceId))
                .andExpect(jsonPath("$.message").value("워크스페이스가 비활성화되었습니다."));
    }
}
