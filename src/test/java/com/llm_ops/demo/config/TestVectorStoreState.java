package com.llm_ops.demo.config;

import java.util.Collections;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.ai.document.Document;
import org.springframework.stereotype.Component;

@Component
public class TestVectorStoreState {

    private final List<Document> documents = new CopyOnWriteArrayList<>();

    public void addDocument(Document document) {
        if (document != null) {
            documents.add(document);
        }
    }

    public List<Document> getDocuments() {
        return Collections.unmodifiableList(documents);
    }

    public void clear() {
        documents.clear();
    }
}
