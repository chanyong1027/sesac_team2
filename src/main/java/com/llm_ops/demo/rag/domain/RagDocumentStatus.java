package com.llm_ops.demo.rag.domain;

public enum RagDocumentStatus {
    UPLOADED,
    PARSING,
    CHUNKING,
    EMBEDDING,
    INDEXING,
    DONE,
    FAILED,
    ACTIVE, // legacy (treated as DONE)
    DELETING,
    DELETED
}
