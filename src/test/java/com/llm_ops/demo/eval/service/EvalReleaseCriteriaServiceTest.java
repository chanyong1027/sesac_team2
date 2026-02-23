package com.llm_ops.demo.eval.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.llm_ops.demo.eval.domain.EvalReleaseCriteria;
import com.llm_ops.demo.eval.domain.EvalReleaseCriteriaAudit;
import com.llm_ops.demo.eval.dto.EvalReleaseCriteriaAuditResponse;
import com.llm_ops.demo.eval.dto.EvalReleaseCriteriaResponse;
import com.llm_ops.demo.eval.dto.EvalReleaseCriteriaUpdateRequest;
import com.llm_ops.demo.eval.repository.EvalReleaseCriteriaAuditRepository;
import com.llm_ops.demo.eval.repository.EvalReleaseCriteriaRepository;
import com.llm_ops.demo.workspace.service.WorkspaceAccessService;
import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class EvalReleaseCriteriaServiceTest {

    private final EvalReleaseCriteriaRepository evalReleaseCriteriaRepository = mock(EvalReleaseCriteriaRepository.class);
    private final EvalReleaseCriteriaAuditRepository evalReleaseCriteriaAuditRepository = mock(EvalReleaseCriteriaAuditRepository.class);
    private final WorkspaceAccessService workspaceAccessService = mock(WorkspaceAccessService.class);

    private final EvalReleaseCriteriaService service = new EvalReleaseCriteriaService(
            evalReleaseCriteriaRepository,
            evalReleaseCriteriaAuditRepository,
            workspaceAccessService
    );

    @Test
    @DisplayName("배포 판정 기준 저장은 워크스페이스 OWNER 권한을 검증하고 감사 이력을 남긴다")
    void 배포_판정_기준_저장은_owner_권한을_검증하고_감사_이력을_남긴다() {
        // given
        Long workspaceId = 7L;
        Long userId = 99L;
        EvalReleaseCriteria criteria = EvalReleaseCriteria.createDefault(workspaceId);
        EvalReleaseCriteriaUpdateRequest request = new EvalReleaseCriteriaUpdateRequest(92.5, 82.0, 4.5, 5.0);

        when(evalReleaseCriteriaRepository.findByWorkspaceId(workspaceId)).thenReturn(Optional.of(criteria));
        when(evalReleaseCriteriaRepository.saveAndFlush(any(EvalReleaseCriteria.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // when
        EvalReleaseCriteriaResponse response = service.upsert(workspaceId, userId, request);

        // then
        verify(workspaceAccessService).validateWorkspaceOwner(workspaceId, userId);
        verify(evalReleaseCriteriaRepository).saveAndFlush(criteria);

        ArgumentCaptor<EvalReleaseCriteriaAudit> auditCaptor = ArgumentCaptor.forClass(EvalReleaseCriteriaAudit.class);
        verify(evalReleaseCriteriaAuditRepository).save(auditCaptor.capture());
        EvalReleaseCriteriaAudit savedAudit = auditCaptor.getValue();

        assertThat(savedAudit.getWorkspaceId()).isEqualTo(workspaceId);
        assertThat(savedAudit.getChangedBy()).isEqualTo(userId);
        assertThat(savedAudit.getMinPassRate()).isEqualTo(92.5);
        assertThat(savedAudit.getMinAvgOverallScore()).isEqualTo(82.0);
        assertThat(savedAudit.getMaxErrorRate()).isEqualTo(4.5);
        assertThat(savedAudit.getMinImprovementNoticeDelta()).isEqualTo(5.0);

        assertThat(response.workspaceId()).isEqualTo(workspaceId);
        assertThat(response.updatedBy()).isEqualTo(userId);
        assertThat(response.minPassRate()).isEqualTo(92.5);
    }

    @Test
    @DisplayName("배포 판정 기준 변경 이력 조회는 접근 권한을 검증하고 최신순 응답을 반환한다")
    void 배포_판정_기준_변경_이력_조회는_접근_권한을_검증하고_최신순_응답을_반환한다() {
        // given
        Long workspaceId = 12L;
        Long userId = 22L;

        EvalReleaseCriteria criteria = EvalReleaseCriteria.createDefault(workspaceId);
        criteria.update(90.0, 80.0, 3.0, 2.0, 100L);

        EvalReleaseCriteriaAudit latest = EvalReleaseCriteriaAudit.create(criteria, 100L);
        setField(latest, "id", 501L);
        setField(latest, "changedAt", LocalDateTime.of(2026, 2, 23, 14, 0));

        EvalReleaseCriteriaAudit older = EvalReleaseCriteriaAudit.create(criteria, 90L);
        setField(older, "id", 500L);
        setField(older, "changedAt", LocalDateTime.of(2026, 2, 22, 9, 30));

        when(evalReleaseCriteriaAuditRepository.findTop20ByWorkspaceIdOrderByChangedAtDesc(eq(workspaceId)))
                .thenReturn(List.of(latest, older));

        // when
        List<EvalReleaseCriteriaAuditResponse> result = service.listHistory(workspaceId, userId);

        // then
        verify(workspaceAccessService).validateWorkspaceAccess(workspaceId, userId);
        assertThat(result).hasSize(2);
        assertThat(result.get(0).id()).isEqualTo(501L);
        assertThat(result.get(0).changedBy()).isEqualTo(100L);
        assertThat(result.get(1).id()).isEqualTo(500L);
        assertThat(result.get(1).changedBy()).isEqualTo(90L);
    }

    private static void setField(Object target, String fieldName, Object value) {
        try {
            Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException exception) {
            throw new IllegalStateException("필드 설정에 실패했습니다: " + fieldName, exception);
        }
    }
}
