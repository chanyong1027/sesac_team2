package com.llm_ops.demo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class LlmOpsApplication {

	public static void main(String[] args) {
		SpringApplication.run(LlmOpsApplication.class, args);
	}

}
