package com.llm_ops.demo.organization.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.organization.domain.Organization;
import com.llm_ops.demo.organization.domain.OrganizationRole;
import com.llm_ops.demo.organization.domain.OrganizationStatus;
import com.llm_ops.demo.organization.dto.OrganizationCreateRequest;
import com.llm_ops.demo.organization.dto.OrganizationCreateResponse;
import com.llm_ops.demo.organization.repository.OrganizationMemberRepository;
import com.llm_ops.demo.organization.repository.OrganizationRepository;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class OrganizationServiceTest {

    @InjectMocks
    private OrganizationService organizationService;

    @Mock
    private OrganizationRepository organizationRepository;

    @Mock
    private OrganizationMemberRepository organizationMemberRepository;

    @Mock
    private UserRepository userRepository;

    @Test
    @DisplayName("조직을 생성한다")
    void create_Success() throws Exception {
        // given
        Long userId = 1L;
        OrganizationCreateRequest request = new OrganizationCreateRequest("테스트 조직");

        User mockUser = User.create("test@example.com", "encodedPassword", "테스트 유저");
        var userIdField = User.class.getDeclaredField("id");
        userIdField.setAccessible(true);
        userIdField.set(mockUser, userId);

        given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
        given(organizationRepository.save(any(Organization.class))).willAnswer(invocation -> {
            Organization org = invocation.getArgument(0);
            var idField = Organization.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(org, 1L);
            return org;
        });

        // when
        OrganizationCreateResponse response = organizationService.create(userId, request);

        // then
        assertThat(response.id()).isEqualTo(1L);
        assertThat(response.name()).isEqualTo("테스트 조직");
        assertThat(response.status()).isEqualTo(OrganizationStatus.ACTIVE);

        verify(userRepository).findById(userId);
        verify(organizationRepository).save(any(Organization.class));
        verify(organizationMemberRepository).save(argThat(member ->
            member.getRole() == OrganizationRole.OWNER &&
            member.getUser().equals(mockUser)
        ));
    }

    @Test
    @DisplayName("존재하지 않는 사용자로 조직 생성 시 예외가 발생한다")
    void create_UserNotFound_ThrowsException() {
        // given
        Long userId = 999L;
        OrganizationCreateRequest request = new OrganizationCreateRequest("테스트 조직");

        given(userRepository.findById(userId)).willReturn(Optional.empty());

        // when & then
        assertThatThrownBy(() -> organizationService.create(userId, request))
            .isInstanceOf(BusinessException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);

        verify(userRepository).findById(userId);
    }
}
