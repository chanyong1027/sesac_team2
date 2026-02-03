package com.llm_ops.demo.gateway.log.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.llm_ops.demo.gateway.log.service.RequestLogQueryService;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.workspace.service.WorkspaceAccessService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(RequestLogController.class)
@WithMockUser
class RequestLogControllerTest {

        @Autowired
        private MockMvc mockMvc;

        @MockitoBean
        private RequestLogQueryService requestLogQueryService;

        @MockitoBean
        private WorkspaceAccessService workspaceAccessService;

        @Test
        @DisplayName("traceId_조회시_워크스페이스_멤버가_아니면_403_Forbidden을_반환한다")
        void traceId_조회시_워크스페이스_멤버가_아니면_403_Forbidden을_반환한다() throws Exception {
                // given
                doThrow(new BusinessException(ErrorCode.FORBIDDEN))
                                .when(workspaceAccessService)
                                .validateWorkspaceAccess(any(), any());

                // when & then
                mockMvc.perform(get("/api/v1/workspaces/999/logs/trace-1"))
                                .andDo(print())
                                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("로그_목록_조회시_워크스페이스_멤버가_아니면_403_을_반환한다")
        void 로그_목록_조회시_워크스페이스_멤버가_아니면_403_을_반환한다() throws Exception {
                // given
                doThrow(new BusinessException(ErrorCode.FORBIDDEN, "워크스페이스 멤버가 아닙니다."))
                                .when(workspaceAccessService)
                                .validateWorkspaceAccess(any(), any());

                // when & then
                mockMvc.perform(get("/api/v1/workspaces/999/logs"))
                                .andDo(print())
                                .andExpect(status().isForbidden());
        }
}
