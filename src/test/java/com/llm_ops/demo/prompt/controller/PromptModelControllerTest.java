package com.llm_ops.demo.prompt.controller;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.llm_ops.demo.config.TestSecurityConfig;
import com.llm_ops.demo.prompt.service.PromptModelAllowlistService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(PromptModelController.class)
@AutoConfigureMockMvc
@ActiveProfiles({"test", "mock-auth"})
@Import(TestSecurityConfig.class)
class PromptModelControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PromptModelAllowlistService promptModelAllowlistService;

    @Test
    @DisplayName("모델 allowlist를 조회한다")
    void getAllowlist_ReturnsAllowlist() throws Exception {
        given(promptModelAllowlistService.getAllowlist()).willReturn(Map.of(
                "OPENAI", List.of("gpt-4o-mini"),
                "ANTHROPIC", List.of("claude-3-5-sonnet"),
                "GEMINI", List.of("gemini-2.0-flash")
        ));

        mockMvc.perform(get("/api/v1/models/allowlist"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.OPENAI[0]").value("gpt-4o-mini"))
                .andExpect(jsonPath("$.ANTHROPIC[0]").value("claude-3-5-sonnet"))
                .andExpect(jsonPath("$.GEMINI[0]").value("gemini-2.0-flash"));
    }
}
