package com.llm_ops.demo.config;

import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.util.List;
import java.util.Optional;

@Configuration
@Profile("test")
public class TestVectorStoreConfig {

    @Bean
    TestVectorStoreState testVectorStoreState() {
        return new TestVectorStoreState();
    }

    @Bean(name = "vectorStore")
    VectorStore vectorStore(TestVectorStoreState testVectorStoreState) {
        return new VectorStore() {
            @Override
            public void add(List<Document> documents) {
                testVectorStoreState.addDocuments(documents);
            }

            @Override
            public Optional<Boolean> delete(List<String> idList) {
                idList.forEach(testVectorStoreState::deleteDocument);
                return Optional.of(true);
            }

            @Override
            public List<Document> similaritySearch(String query) {
                testVectorStoreState.recordQuery(query);
                return testVectorStoreState.getDocuments();
            }

            @Override
            public List<Document> similaritySearch(org.springframework.ai.vectorstore.SearchRequest request) {
                testVectorStoreState.recordQuery(request.getQuery());
                return testVectorStoreState.getDocuments();
            }
        };
    }
}
