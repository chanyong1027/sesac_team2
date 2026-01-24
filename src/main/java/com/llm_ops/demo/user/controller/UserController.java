package com.llm_ops.demo.user.controller;

import com.llm_ops.demo.user.dto.response.UserMeResponse;
import com.llm_ops.demo.user.service.UserService;
import com.llm_ops.demo.auth.dto.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserMeResponse>> getMe(@AuthenticationPrincipal Long userId) {
        UserMeResponse response = userService.getMe(userId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
