package com.llm_ops.demo.eval.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.llm_ops.demo.eval.config.EvalProperties;
import com.llm_ops.demo.eval.domain.EvalMode;
import com.llm_ops.demo.eval.rubric.ResolvedRubricConfig;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class EvalJudgeServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("ruleChecks 경고만 있으면 모델/Judge 통과 결과를 유지한다")
    void ruleChecks_경고만_있으면_모델_Judge_통과_결과를_유지한다() {
        // given
        EvalProperties properties = new EvalProperties();
        properties.getJudge().setRejudgeOnFail(false);
        properties.getJudge().setMaxAttempts(1);

        EvalModelRunnerService runner = mock(EvalModelRunnerService.class);
        when(runner.run(anyLong(), any(), anyString(), anyString(), any(), isNull()))
                .thenReturn(modelExecution("""
                        {
                          "pass": true,
                          "scores": {"quality": 5},
                          "labels": [],
                          "evidence": [],
                          "suggestions": []
                        }
                        """));

        EvalJudgeService service = new EvalJudgeService(properties, runner, objectMapper);
        ResolvedRubricConfig rubric = new ResolvedRubricConfig(
                "CUSTOM",
                "test",
                Map.of("quality", 1.0),
                Map.of("minOverallScore", 70.0),
                Map.of()
        );

        // when
        EvalJudgeService.JudgeResult result = service.judge(
                1L,
                rubric,
                "input",
                Map.of(),
                Map.of(),
                Map.of(),
                "candidate output",
                Map.of(
                        "pass", true,
                        "failedChecks", List.of(),
                        "warningChecks", List.of("must_include")
                ),
                null
        );

        // then
        assertThat(result.pass()).isTrue();
        assertThat(result.judgeOutput().get("pass")).isEqualTo(true);
        verify(runner, times(1)).run(anyLong(), any(), anyString(), anyString(), any(), isNull());
    }

    @Test
    @DisplayName("중요 기준 최소 점수 게이트를 못 넘으면 fail 처리한다")
    void 중요_기준_최소_점수_게이트를_못_넘으면_fail_처리한다() {
        // given
        EvalProperties properties = new EvalProperties();
        properties.getJudge().setRejudgeOnFail(false);
        properties.getJudge().setMaxAttempts(1);

        EvalModelRunnerService runner = mock(EvalModelRunnerService.class);
        when(runner.run(anyLong(), any(), anyString(), anyString(), any(), isNull()))
                .thenReturn(modelExecution("""
                        {
                          "pass": true,
                          "scores": {"accuracy": 2, "clarity": 5},
                          "labels": [],
                          "evidence": [],
                          "suggestions": []
                        }
                        """));

        EvalJudgeService service = new EvalJudgeService(properties, runner, objectMapper);
        ResolvedRubricConfig rubric = new ResolvedRubricConfig(
                "CUSTOM",
                "test",
                Map.of("accuracy", 1.0, "clarity", 1.0),
                Map.of(
                        "minOverallScore", 50.0,
                        "minCriterionScores", Map.of("accuracy", 3.0)
                ),
                Map.of()
        );

        // when
        EvalJudgeService.JudgeResult result = service.judge(
                1L,
                rubric,
                "input",
                Map.of(),
                Map.of(),
                Map.of(),
                "candidate output",
                Map.of("pass", true),
                null
        );

        // then
        assertThat(result.pass()).isFalse();
        assertThat(result.judgeOutput().get("pass")).isEqualTo(false);
        verify(runner, times(1)).run(anyLong(), any(), anyString(), anyString(), any(), isNull());
    }

    @Test
    @DisplayName("첫 Judge 실패 후 재판정에서 통과하면 최종 pass=true로 반영한다")
    @SuppressWarnings("unchecked")
    void 첫_judge_실패_후_재판정에서_통과하면_최종_pass_true로_반영한다() {
        // given
        EvalProperties properties = new EvalProperties();
        properties.getJudge().setRejudgeOnFail(true);
        properties.getJudge().setMaxAttempts(2);

        EvalModelRunnerService runner = mock(EvalModelRunnerService.class);
        when(runner.run(anyLong(), any(), anyString(), anyString(), any(), isNull()))
                .thenReturn(modelExecution("""
                        {
                          "pass": false,
                          "scores": {"quality": 2},
                          "labels": ["low_quality"],
                          "evidence": ["too short"],
                          "suggestions": ["add details"]
                        }
                        """))
                .thenReturn(modelExecution("""
                        {
                          "pass": true,
                          "scores": {"quality": 5},
                          "labels": [],
                          "evidence": ["covered all points"],
                          "suggestions": []
                        }
                        """));

        EvalJudgeService service = new EvalJudgeService(properties, runner, objectMapper);
        ResolvedRubricConfig rubric = new ResolvedRubricConfig(
                "CUSTOM",
                "test",
                Map.of("quality", 1.0),
                Map.of("minOverallScore", 70.0),
                Map.of()
        );

        // when
        EvalJudgeService.JudgeResult result = service.judge(
                1L,
                rubric,
                "input",
                Map.of(),
                Map.of(),
                Map.of(),
                "candidate output",
                Map.of("pass", true),
                null
        );

        // then
        assertThat(result.pass()).isTrue();
        assertThat(result.judgeOutput().get("pass")).isEqualTo(true);
        List<Map<String, Object>> attempts = (List<Map<String, Object>>) result.judgeOutput().get("judgeAttempts");
        assertThat(attempts).hasSize(2);
        assertThat(result.judgeOutput().get("judgeDecisionStrategy")).isEqualTo("PASS_IF_ANY_ELSE_BEST_SCORE");
        verify(runner, times(2)).run(anyLong(), any(), anyString(), anyString(), any(), isNull());
    }

    @Test
    @DisplayName("재판정 비활성화면 첫 실패 후 즉시 종료한다")
    void 재판정_비활성화면_첫_실패_후_즉시_종료한다() {
        // given
        EvalProperties properties = new EvalProperties();
        properties.getJudge().setRejudgeOnFail(false);
        properties.getJudge().setMaxAttempts(3);

        EvalModelRunnerService runner = mock(EvalModelRunnerService.class);
        when(runner.run(anyLong(), any(), anyString(), anyString(), any(), isNull()))
                .thenReturn(modelExecution("""
                        {
                          "pass": false,
                          "scores": {"quality": 2},
                          "labels": ["low_quality"],
                          "evidence": [],
                          "suggestions": []
                        }
                        """));

        EvalJudgeService service = new EvalJudgeService(properties, runner, objectMapper);
        ResolvedRubricConfig rubric = new ResolvedRubricConfig(
                "CUSTOM",
                "test",
                Map.of("quality", 1.0),
                Map.of("minOverallScore", 70.0),
                Map.of()
        );

        // when
        EvalJudgeService.JudgeResult result = service.judge(
                1L,
                rubric,
                "input",
                Map.of(),
                Map.of(),
                Map.of(),
                "candidate output",
                Map.of("pass", true),
                null
        );

        // then
        assertThat(result.pass()).isFalse();
        assertThat(result.judgeOutput()).doesNotContainKey("judgeAttempts");
        verify(runner, times(1)).run(anyLong(), any(), anyString(), anyString(), any(), isNull());
    }

    @Test
    @DisplayName("Judge 프롬프트 직렬화에 실패하면 예외를 던진다")
    void Judge_프롬프트_직렬화에_실패하면_예외를_던진다() throws Exception {
        // given
        EvalProperties properties = new EvalProperties();
        EvalModelRunnerService runner = mock(EvalModelRunnerService.class);
        ObjectMapper failingObjectMapper = mock(ObjectMapper.class);
        when(failingObjectMapper.writeValueAsString(any())).thenThrow(new RuntimeException("serialize fail"));

        EvalJudgeService service = new EvalJudgeService(properties, runner, failingObjectMapper);
        ResolvedRubricConfig rubric = new ResolvedRubricConfig(
                "CUSTOM",
                "test",
                Map.of("quality", 1.0),
                Map.of("minOverallScore", 70.0),
                Map.of()
        );

        // when // then
        assertThatThrownBy(() -> service.judge(
                1L,
                rubric,
                "input",
                Map.of(),
                Map.of(),
                Map.of(),
                "candidate output",
                Map.of("pass", true),
                null
        ))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Judge prompt payload serialization failed");
        verify(runner, times(0)).run(anyLong(), any(), anyString(), anyString(), any(), isNull());
    }

    @Test
    @DisplayName("Run 종합평가를 JSON으로 파싱해 summary 객체를 반환한다")
    void Run_종합평가를_JSON으로_파싱해_summary_객체를_반환한다() {
        // given
        EvalProperties properties = new EvalProperties();
        EvalModelRunnerService runner = mock(EvalModelRunnerService.class);
        when(runner.run(anyLong(), any(), anyString(), anyString(), any(), isNull()))
                .thenReturn(modelExecution("""
                        {
                          "overallComment": "후보 버전은 전반적으로 안정적이며 품질이 개선되었습니다.",
                          "verdictReason": "PassRate 100%와 평균점수 90점으로 배포 가능 수준입니다.",
                          "strengths": ["핵심 정보 누락이 없음", "답변 일관성 향상"],
                          "risks": ["응답 지연 증가 가능성"],
                          "nextActions": ["피크 트래픽 구간에서 재검증"]
                        }
                        """));

        EvalJudgeService service = new EvalJudgeService(properties, runner, objectMapper);

        // when
        EvalJudgeService.RunOverallReviewResult result = service.summarizeRun(
                1L,
                EvalMode.CANDIDATE_ONLY,
                Map.of("passRate", 100.0, "avgOverallScore", 90.0),
                List.of(Map.of("caseResultId", 1L, "pass", true))
        );

        // then
        assertThat(result.review().get("overallComment")).isEqualTo("후보 버전은 전반적으로 안정적이며 품질이 개선되었습니다.");
        assertThat(result.review().get("verdictReason")).isEqualTo("PassRate 100%와 평균점수 90점으로 배포 가능 수준입니다.");
        assertThat(result.review().get("strengths")).isEqualTo(List.of("핵심 정보 누락이 없음", "답변 일관성 향상"));
        assertThat(result.meta()).isNotNull();
        verify(runner, times(1)).run(anyLong(), any(), anyString(), anyString(), any(), isNull());
    }

    @Test
    @DisplayName("Run 종합평가 응답이 JSON이 아니면 fallback 문구를 반환한다")
    void Run_종합평가_응답이_JSON이_아니면_fallback_문구를_반환한다() {
        // given
        EvalProperties properties = new EvalProperties();
        EvalModelRunnerService runner = mock(EvalModelRunnerService.class);
        when(runner.run(anyLong(), any(), anyString(), anyString(), any(), isNull()))
                .thenReturn(modelExecution("overall: ok"));

        EvalJudgeService service = new EvalJudgeService(properties, runner, objectMapper);

        // when
        EvalJudgeService.RunOverallReviewResult result = service.summarizeRun(
                1L,
                EvalMode.COMPARE_ACTIVE,
                Map.of("passRate", 80.0),
                List.of()
        );

        // then
        assertThat(result.review().get("overallComment")).isEqualTo("전체 결과를 기반으로 한 종합평가를 생성하지 못했습니다.");
        assertThat(result.review().get("risks")).isEqualTo(List.of("LLM 종합평가 생성 실패"));
        verify(runner, times(1)).run(anyLong(), any(), anyString(), anyString(), any(), isNull());
    }

    private EvalModelRunnerService.ModelExecution modelExecution(String output) {
        return new EvalModelRunnerService.ModelExecution(output, Map.of("latencyMs", 10));
    }
}
