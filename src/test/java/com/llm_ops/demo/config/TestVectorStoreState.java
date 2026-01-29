package com.llm_ops.demo.config;

import org.springframework.ai.document.Document;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

public class TestVectorStoreState {

    private final List<Document> documents = new ArrayList<>();
    private final AtomicReference<String> lastQuery = new AtomicReference<>();

    public void recordQuery(String query) {
        lastQuery.set(query);
    }

    public String getLastQuery() {
        return lastQuery.get();
    }

    public void addDocuments(List<Document> docs) {
        documents.addAll(docs);
    }

    public void addDocument(Document doc) {
        documents.add(doc);
    }

    public void deleteDocument(String id) {
        documents.removeIf(doc -> id.equals(doc.getId()));
    }

    public List<Document> getDocuments() {
        return new ArrayList<>(documents);
    }

    public void clear() {
        documents.clear();
        lastQuery.set(null);
    }
}
