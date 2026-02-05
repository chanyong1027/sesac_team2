package com.llm_ops.demo.workspace.service;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.workspace.dto.WorkspaceSummaryResponse;
import com.llm_ops.demo.workspace.repository.WorkspaceMemberRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WorkspaceListService {

    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final UserRepository userRepository;

    public List<WorkspaceSummaryResponse> getMyWorkspaces(Long userId) {
        User user = findUserById(userId);

        return workspaceMemberRepository.findByUserWithWorkspaceAndOrganization(user)
            .stream()
            .map(WorkspaceSummaryResponse::from)
            .toList();
    }

    private User findUserById(Long userId) {
        return userRepository.findById(userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }
}
