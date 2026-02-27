package com.llm_ops.demo.global.util;

import java.util.Map;

public final class LoggingUtils {

    public static final int LOGGED_QUESTION_MAX_CHARS = 500;

    private LoggingUtils() {
    }

    public static String extractQuestionForLog(Map<String, ?> variables) {
        if (variables == null || variables.isEmpty()) {
            return null;
        }

        String[] preferredKeys = {"question", "query", "input", "message", "userInput", "userQuery"};
        for (String key : preferredKeys) {
            String candidate = normalizeQuestion(variables.get(key));
            if (candidate != null) {
                return candidate;
            }
        }
        return null;
    }

    public static String normalizeQuestion(Object raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = String.valueOf(raw).trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.length() > LOGGED_QUESTION_MAX_CHARS) {
            return trimmed.substring(0, LOGGED_QUESTION_MAX_CHARS);
        }
        return trimmed;
    }
}
