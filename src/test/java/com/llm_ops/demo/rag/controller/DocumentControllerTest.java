package com.llm_ops.demo.rag.controller;

import static org.mockito.BDDMockito.given;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.eq;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.llm_ops.demo.rag.domain.RagDocument;
import com.llm_ops.demo.rag.service.RagDocumentCreateService;
import com.llm_ops.demo.rag.service.RagDocumentDeleteService;
import com.llm_ops.demo.rag.service.RagDocumentIngestService;
import com.llm_ops.demo.rag.service.RagDocumentListService;
import com.llm_ops.demo.rag.service.RagDocumentVectorStoreDeleteService;
import com.llm_ops.demo.rag.storage.S3ApiClient;
import com.llm_ops.demo.workspace.service.WorkspaceAccessService;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@TestPropertySource(properties = "storage.s3.enabled=true")
class DocumentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private S3ApiClient s3ApiClient;

    @MockitoBean
    private RagDocumentCreateService ragDocumentCreateService;

    @MockitoBean
    private RagDocumentListService ragDocumentListService;

    @MockitoBean
    private RagDocumentDeleteService ragDocumentDeleteService;

    @MockitoBean
    private RagDocumentIngestService ragDocumentIngestService;

    @MockitoBean
    private RagDocumentVectorStoreDeleteService ragDocumentVectorStoreDeleteService;

    @MockitoBean
    private WorkspaceAccessService workspaceAccessService;

    @Test
    @DisplayName("문서 업로드 API 성공")
    void uploadDocument_Success() throws Exception {
        // given
        Long workspaceId = 1L;
        Long userId = 1L;
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "sample.txt",
                "text/plain",
                "hello".getBytes()
        );

        given(s3ApiClient.uploadDocument(
                eq(workspaceId),
                eq("sample.txt"),
                any(InputStream.class),
                eq(file.getSize()),
                eq(file.getContentType()),
                anyMap()
        )).willReturn("workspaces/1/documents/sample.txt");

        RagDocument document = RagDocument.create(workspaceId, "sample.txt", "workspaces/1/documents/sample.txt");
        ReflectionTestUtils.setField(document, "id", 10L);
        given(ragDocumentCreateService.create(workspaceId, "sample.txt", "workspaces/1/documents/sample.txt"))
                .willReturn(document);

        // when & then
        mockMvc.perform(multipart("/api/v1/workspaces/{workspaceId}/documents", workspaceId)
                .file(file)
                .header("X-User-Id", userId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.documentId").value(10L))
            .andExpect(jsonPath("$.status").value("ACTIVE"));

        verify(ragDocumentIngestService).ingest(eq(workspaceId), eq(10L), any(org.springframework.core.io.Resource.class));
    }

    @Test
    @DisplayName("문서 목록 조회 API 성공")
    void getDocuments_Success() throws Exception {
        // given
        Long workspaceId = 1L;
        Long userId = 1L;
        RagDocument first = RagDocument.create(workspaceId, "a.txt", "workspaces/1/documents/a.txt");
        RagDocument second = RagDocument.create(workspaceId, "b.txt", "workspaces/1/documents/b.txt");
        ReflectionTestUtils.setField(first, "id", 1L);
        ReflectionTestUtils.setField(second, "id", 2L);
        ReflectionTestUtils.setField(first, "createdAt", LocalDateTime.now());
        ReflectionTestUtils.setField(second, "createdAt", LocalDateTime.now());

        given(ragDocumentListService.findActiveDocuments(workspaceId)).willReturn(List.of(first, second));

        // when & then
        mockMvc.perform(get("/api/v1/workspaces/{workspaceId}/documents", workspaceId)
                .header("X-User-Id", userId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(1L))
            .andExpect(jsonPath("$[0].fileName").value("a.txt"))
            .andExpect(jsonPath("$[0].status").value("ACTIVE"))
            .andExpect(jsonPath("$[1].id").value(2L))
            .andExpect(jsonPath("$[1].fileName").value("b.txt"))
            .andExpect(jsonPath("$[1].status").value("ACTIVE"));
    }

    @Test
    @DisplayName("문서 삭제 API 성공")
    void deleteDocument_Success() throws Exception {
        // given
        Long workspaceId = 1L;
        Long documentId = 10L;
        Long userId = 1L;
        RagDocument document = RagDocument.create(workspaceId, "sample.txt", "workspaces/1/documents/sample.txt");
        ReflectionTestUtils.setField(document, "id", documentId);
        given(ragDocumentDeleteService.delete(workspaceId, documentId)).willReturn(document);

        // when & then
        mockMvc.perform(delete("/api/v1/workspaces/{workspaceId}/documents/{documentId}", workspaceId, documentId)
                .header("X-User-Id", userId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.documentId").value(documentId))
            .andExpect(jsonPath("$.message").value("삭제되었습니다."));

        verify(s3ApiClient).deleteDocument("workspaces/1/documents/sample.txt");
        verify(ragDocumentVectorStoreDeleteService).deleteByDocumentId(documentId);
    }
}
