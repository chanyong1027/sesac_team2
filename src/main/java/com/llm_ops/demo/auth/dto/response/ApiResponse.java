package com.llm_ops.demo.auth.dto.response;

/**
 * 공통 성공 응답 포맷
 * api-spec.md 1.1 성공 응답 규격에 따름
 */
public record ApiResponse<T>(
        String code,
        String message,
        T data) {
    private static final String SUCCESS_CODE = "COMMON_SUCCESS";
    private static final String SUCCESS_MESSAGE = "요청이 성공적으로 처리되었습니다.";

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(SUCCESS_CODE, SUCCESS_MESSAGE, data);
    }
}
