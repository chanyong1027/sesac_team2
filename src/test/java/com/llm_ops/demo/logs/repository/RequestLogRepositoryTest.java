package com.llm_ops.demo.logs.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.logs.domain.RequestLog;
import com.llm_ops.demo.organization.domain.Organization;
import com.llm_ops.demo.organization.repository.OrganizationRepository;
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.repository.WorkspaceRepository;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * RequestLog 엔티티 및 Repository 테스트.
 *
 * <h2>테스트 목적</h2>
 * <ul>
 * <li>JPA 엔티티 매핑이 정상적으로 동작하는지 확인</li>
 * <li>Long PK 저장 및 조회가 정상적으로 동작하는지 확인</li>
 * <li>Workspace와의 연관관계 매핑이 정상인지 확인</li>
 * </ul>
 */
@DataJpaTest
@ActiveProfiles("test")
@DisplayName("RequestLogRepository 테스트")
class RequestLogRepositoryTest {

    @Autowired
    private RequestLogRepository requestLogRepository;

    @Autowired
    private WorkspaceRepository workspaceRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    private Workspace testWorkspace;

    @BeforeEach
    void setUp() {
        // given: 테스트용 User, Organization, Workspace를 미리 생성
        User testUser = userRepository.save(
                User.create("test@example.com", "password123", "Test User"));
        Organization organization = organizationRepository.save(
                Organization.create("Test Organization", testUser));
        testWorkspace = workspaceRepository.save(
                Workspace.create(organization, "test-ws", "Test Workspace"));
    }

    @Nested
    @DisplayName("save() 메소드는")
    class SaveTest {

        @Test
        @DisplayName("RequestLog를 저장하면_저장된_엔티티가_반환된다")
        void save_하면_저장된_엔티티가_반환된다() {
            // given: 저장할 RequestLog 생성
            UUID traceId = UUID.randomUUID();
            RequestLog requestLog = RequestLog.builder()
                    .traceId(traceId)
                    .workspace(testWorkspace)
                    .promptVersionId(1L)
                    .totalTokens(150)
                    .estimatedCost(new BigDecimal("0.0015"))
                    .latencyMs(350)
                    .statusCode(200)
                    .build();

            // when: 저장
            RequestLog saved = requestLogRepository.save(requestLog);

            // then: 저장된 엔티티 검증
            assertThat(saved).isNotNull();
            assertThat(saved.getTraceId()).isEqualTo(traceId);
            assertThat(saved.getWorkspace().getId()).isEqualTo(testWorkspace.getId());
            assertThat(saved.getTotalTokens()).isEqualTo(150);
            assertThat(saved.getEstimatedCost()).isEqualByComparingTo(new BigDecimal("0.0015"));
            // Note: @CreationTimestamp는 실제 DB에 커밋 후 조회해야 반영됨 (H2 테스트 환경 특성)
        }
    }

    @Nested
    @DisplayName("findById() 메소드는")
    class FindByIdTest {

        @Test
        @DisplayName("존재하는_id로_조회하면_해당_로그가_반환된다")
        void 존재하는_id로_조회하면_해당_로그가_반환된다() {
            // given: 로그 저장
            UUID traceId = UUID.randomUUID();
            RequestLog requestLog = RequestLog.builder()
                    .traceId(traceId)
                    .workspace(testWorkspace)
                    .totalTokens(100)
                    .latencyMs(200)
                    .statusCode(200)
                    .build();
            RequestLog saved = requestLogRepository.save(requestLog);

            // when: id로 조회
            Optional<RequestLog> found = requestLogRepository.findById(saved.getId());

            // then: 조회 결과 검증
            assertThat(found).isPresent();
            assertThat(found.get().getTraceId()).isEqualTo(traceId);
            assertThat(found.get().getTotalTokens()).isEqualTo(100);
        }

        @Test
        @DisplayName("존재하지_않는_id로_조회하면_빈_Optional이_반환된다")
        void 존재하지_않는_id로_조회하면_빈_Optional이_반환된다() {
            // given: 존재하지 않는 ID
            Long nonExistentId = 999999L;

            // when: 조회
            Optional<RequestLog> found = requestLogRepository.findById(nonExistentId);

            // then: 빈 결과 검증
            assertThat(found).isEmpty();
        }
    }

    @Nested
    @DisplayName("에러 상황 로그 저장")
    class ErrorLogTest {

        @Test
        @DisplayName("errorCode가_있는_로그도_정상_저장된다")
        void errorCode가_있는_로그도_정상_저장된다() {
            // given: 에러 상태의 로그
            UUID traceId = UUID.randomUUID();
            RequestLog errorLog = RequestLog.builder()
                    .traceId(traceId)
                    .workspace(testWorkspace)
                    .totalTokens(0)
                    .latencyMs(50)
                    .statusCode(500)
                    .errorCode("LLM_TIMEOUT")
                    .build();

            // when: 저장
            RequestLog saved = requestLogRepository.save(errorLog);

            // then: 에러 정보 검증
            assertThat(saved.getStatusCode()).isEqualTo(500);
            assertThat(saved.getErrorCode()).isEqualTo("LLM_TIMEOUT");
        }
    }
}
