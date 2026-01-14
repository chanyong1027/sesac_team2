package com.llm_ops.demo.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SignUpRequest (
        @NotBlank
        @Size(max = 50)
        String email,

        @NotBlank
        @Size(min = 8, max = 100) //최대 길이를 20으로 설정했는데 hashing된 결과가 20을 넘어서 에러가 발생했었다.
        @Pattern(
                regexp = "^(?=.*[A-Za-z])(?=.*\\d)[A-Za-z\\d]+$",
                message = "비밀번호는 영문과 숫자를 포함해야 합니다."
        )
        String passwordHash,


        @NotBlank
        @Size(min = 2, max = 50)
        String userName
){}
