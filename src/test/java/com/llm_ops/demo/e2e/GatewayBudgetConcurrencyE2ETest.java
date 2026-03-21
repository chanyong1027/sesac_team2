package com.llm_ops.demo.e2e;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.budget.domain.BudgetReservation;
import com.llm_ops.demo.budget.domain.BudgetReservationStatus;
import com.llm_ops.demo.budget.domain.BudgetScopeType;
import com.llm_ops.demo.budget.domain.BudgetSoftAction;
import com.llm_ops.demo.budget.dto.BudgetPolicyUpdateRequest;
import com.llm_ops.demo.budget.repository.BudgetMonthlyUsageRepository;
import com.llm_ops.demo.budget.repository.BudgetPolicyRepository;
import com.llm_ops.demo.budget.repository.BudgetReservationRepository;
import com.llm_ops.demo.budget.service.BudgetPolicyService;
import com.llm_ops.demo.budget.service.BudgetReservationEstimate;
import com.llm_ops.demo.budget.service.BudgetReservationEstimator;
import com.llm_ops.demo.budget.service.BudgetUsageService;
import com.llm_ops.demo.config.TestChatModelState;
import com.llm_ops.demo.config.TestSecurityConfig;
import com.llm_ops.demo.gateway.log.repository.RequestLogRepository;
import com.llm_ops.demo.keys.domain.ProviderType;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateRequest;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateResponse;
import com.llm_ops.demo.keys.dto.ProviderCredentialCreateRequest;
import com.llm_ops.demo.keys.repository.OrganizationApiKeyRepository;
import com.llm_ops.demo.keys.repository.ProviderCredentialRepository;
import com.llm_ops.demo.keys.service.OrganizationApiKeyCreateService;
import com.llm_ops.demo.keys.service.ProviderCredentialService;
import com.llm_ops.demo.organization.domain.Organization;
import com.llm_ops.demo.organization.repository.OrganizationRepository;
import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.prompt.domain.PromptRelease;
import com.llm_ops.demo.prompt.domain.PromptVersion;
import com.llm_ops.demo.prompt.repository.PromptReleaseRepository;
import com.llm_ops.demo.prompt.repository.PromptRepository;
import com.llm_ops.demo.prompt.repository.PromptVersionRepository;
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.repository.WorkspaceRepository;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles({"test", "mock-auth"})
@TestPropertySource(properties = "PROVIDER_KEY_ENC_KEY=test-secret")
@Import(TestSecurityConfig.class)
@DisplayName("E2E 통합 테스트 - Gateway Budget Concurrency")
class GatewayBudgetConcurrencyE2ETest {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private OrganizationApiKeyCreateService organizationApiKeyCreateService;

    @Autowired
    private OrganizationApiKeyRepository organizationApiKeyRepository;

    @Autowired
    private ProviderCredentialService providerCredentialService;

    @Autowired
    private ProviderCredentialRepository providerCredentialRepository;

    @Autowired
    private BudgetPolicyService budgetPolicyService;

    @Autowired
    private BudgetPolicyRepository budgetPolicyRepository;

    @Autowired
    private BudgetMonthlyUsageRepository budgetMonthlyUsageRepository;

    @Autowired
    private BudgetReservationRepository budgetReservationRepository;

    @Autowired
    private BudgetReservationEstimator budgetReservationEstimator;

    @Autowired
    private RequestLogRepository requestLogRepository;

    @Autowired
    private TestChatModelState testChatModelState;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private WorkspaceRepository workspaceRepository;

    @Autowired
    private PromptRepository promptRepository;

    @Autowired
    private PromptVersionRepository promptVersionRepository;

    @Autowired
    private PromptReleaseRepository promptReleaseRepository;

    @Autowired
    private TransactionTemplate transactionTemplate;

    private MockMvc mockMvc;
    private OrganizationApiKeyCreateResponse apiKeyResponse;
    private Long organizationId;
    private Long workspaceId;
    private Long providerCredentialId;
    private String promptKey;
    private Workspace workspace;
    private User creatorUser;

    @BeforeEach
    void setUp() {
        mockMvc = webAppContextSetup(context)
            .apply(springSecurity())
            .build();
        clearData();
        testChatModelState.reset();

        creatorUser = userRepository.save(User.create("test@example.com", "password", "tester"));
        Organization organization = organizationRepository.save(Organization.create("테스트 조직", creatorUser));
        workspace = workspaceRepository.save(Workspace.create(organization, "default", "기본"));
        organizationId = organization.getId();
        workspaceId = workspace.getId();
        promptKey = createReleasedPrompt("budget-bot", "hello {{name}}");

        apiKeyResponse = organizationApiKeyCreateService.create(
            organizationId,
            new OrganizationApiKeyCreateRequest("prod")
        );

        providerCredentialService.register(
            organizationId,
            new ProviderCredentialCreateRequest("openai", "provider-key")
        );
        providerCredentialId = activateCredential(organizationId, ProviderType.OPENAI);
        configureBudgetToAllowSingleInFlightRequest();
    }

    @AfterEach
    void tearDown() {
        testChatModelState.releaseBlockedResponses();
        testChatModelState.reset();
        clearData();
    }

    @Test
    @DisplayName("in-flight reservation이 있으면 겹치는 두 번째 HTTP 요청은 429로 차단된다")
    void in_flight_reservation이_있으면_겹치는_두_번째_HTTP_요청은_429로_차단된다() throws Exception {
        // given
        testChatModelState.prepareBlockingResponse();
        ExecutorService executorService = Executors.newFixedThreadPool(2);
        String requestBody = requestBody("lumina");
        YearMonth budgetMonth = YearMonth.now(ZoneOffset.UTC);

        try {
            Future<MvcResult> firstRequest = executorService.submit(() -> performChat(requestBody));
            assertThat(testChatModelState.awaitProviderCallStarted(Duration.ofSeconds(5))).isTrue();

            // when
            Future<MvcResult> secondRequest = executorService.submit(() -> performChat(requestBody));
            MvcResult secondResult = secondRequest.get(5, TimeUnit.SECONDS);
            testChatModelState.releaseBlockedResponses();
            MvcResult firstResult = firstRequest.get(5, TimeUnit.SECONDS);

            // then
            assertThat(firstResult.getResponse().getStatus()).isEqualTo(200);
            assertThat(firstResult.getResponse().getContentAsString()).contains("\"answer\":\"hello lumina\"");

            assertThat(secondResult.getResponse().getStatus()).isEqualTo(429);
            assertThat(secondResult.getResponse().getContentAsString()).contains("\"code\":\"GW-REQ-QUOTA_EXCEEDED\"");

            assertThat(testChatModelState.getCallCount()).isEqualTo(1);
            assertThat(budgetReservationRepository.findAll()).hasSize(1);

            BudgetReservation reservation = budgetReservationRepository.findAll().get(0);
            assertThat(reservation.getStatus()).isEqualTo(BudgetReservationStatus.SETTLED);

            var usage = budgetMonthlyUsageRepository.findByScopeTypeAndScopeIdAndYearMonth(
                BudgetScopeType.PROVIDER_CREDENTIAL,
                providerCredentialId,
                BudgetUsageService.toYearMonthInt(budgetMonth)
            );
            assertThat(usage).isPresent();
            assertThat(usage.orElseThrow().getReservedCostUsd()).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(usage.orElseThrow().getRequestCount()).isEqualTo(1L);
        } finally {
            testChatModelState.releaseBlockedResponses();
            executorService.shutdownNow();
        }
    }

    private MvcResult performChat(String requestBody) throws Exception {
        return mockMvc.perform(post("/v1/chat/completions")
                .header("X-API-Key", apiKeyResponse.apiKey())
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
            .andReturn();
    }

    private String requestBody(String name) {
        return String.format("""
            {
              "workspaceId": %d,
              "promptKey": "%s",
              "variables": {
                "name": "%s"
              }
            }
            """, workspaceId, promptKey, name);
    }

    private void configureBudgetToAllowSingleInFlightRequest() {
        BudgetReservationEstimate estimate = budgetReservationEstimator.estimate(
            "gpt-4o-mini",
            null,
            "hello lumina",
            null
        );
        assertThat(estimate.reservable()).isTrue();

        budgetPolicyService.upsertPolicy(
            BudgetScopeType.PROVIDER_CREDENTIAL,
            providerCredentialId,
            new BudgetPolicyUpdateRequest(
                estimate.reserveAmountUsd(),
                null,
                BudgetSoftAction.DEGRADE,
                Map.of(),
                512,
                false,
                true
            )
        );
    }

    private Long activateCredential(Long orgId, ProviderType providerType) {
        var credential = providerCredentialRepository
            .findByOrganizationIdAndProvider(orgId, providerType)
            .orElseThrow();
        credential.markActive();
        providerCredentialRepository.save(credential);
        return credential.getId();
    }

    private String createReleasedPrompt(String key, String userTemplate) {
        return transactionTemplate.execute(status -> {
            Prompt prompt = promptRepository.save(Prompt.create(workspace, key, "test prompt"));
            PromptVersion version = promptVersionRepository.save(
                PromptVersion.create(
                    prompt,
                    1,
                    "v1",
                    ProviderType.OPENAI,
                    "gpt-4o-mini",
                    null,
                    null,
                    null,
                    userTemplate,
                    false,
                    null,
                    null,
                    creatorUser
                )
            );
            PromptRelease release = PromptRelease.create(prompt, version);
            promptReleaseRepository.save(release);
            return prompt.getPromptKey();
        });
    }

    private void clearData() {
        budgetReservationRepository.deleteAll();
        budgetMonthlyUsageRepository.deleteAll();
        budgetPolicyRepository.deleteAll();
        requestLogRepository.deleteAll();
        organizationApiKeyRepository.deleteAll();
        providerCredentialRepository.deleteAll();
        promptReleaseRepository.deleteAll();
        promptVersionRepository.deleteAll();
        promptRepository.deleteAll();
        workspaceRepository.deleteAll();
        organizationRepository.deleteAll();
        userRepository.deleteAll();
    }
}
