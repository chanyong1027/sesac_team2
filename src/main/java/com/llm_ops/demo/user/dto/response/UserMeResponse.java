package com.llm_ops.demo.user.dto.response;

import com.llm_ops.demo.auth.domain.Status;
import com.llm_ops.demo.auth.domain.User;

public record UserMeResponse(
        Long id,
        String email,
        String name,
        Status status) {
    public static UserMeResponse from(User user) {
        return new UserMeResponse(
                user.getId(),
                user.getEmail(),
                user.getName(),
                user.getStatus());
    }
}
