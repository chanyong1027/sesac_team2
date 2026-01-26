package com.llm_ops.demo.rag.embedding;

import com.google.genai.Client;
import com.google.genai.types.ContentEmbedding;
import com.google.genai.types.EmbedContentConfig;
import com.google.genai.types.EmbedContentResponse;
import com.llm_ops.demo.rag.config.RagEmbeddingProperties;
import org.springframework.ai.document.Document;
import org.springframework.ai.embedding.AbstractEmbeddingModel;
import org.springframework.ai.embedding.Embedding;
import org.springframework.ai.embedding.EmbeddingRequest;
import org.springframework.ai.embedding.EmbeddingResponse;

import java.util.ArrayList;
import java.util.List;

/**
 * Google GenAI 서비스의 임베딩 모델을 Spring AI의 {@link org.springframework.ai.embedding.EmbeddingModel} 인터페이스에 맞게 구현한 클래스입니다.
 * 이 클래스를 통해 Google GenAI를 RAG 파이프라인의 임베딩 생성기로 활용할 수 있습니다.
 */
public class GoogleGenAiEmbeddingModel extends AbstractEmbeddingModel {

    private final Client client;
    private final String model;
    private final Integer outputDimensionality;

    /**
     * GoogleGenAiEmbeddingModel의 생성자입니다.
     *
     * @param client Google GenAI 클라이언트 (Google의 네이티브 API 클라이언트)
     * @param properties 임베딩 모델 설정을 위한 {@link RagEmbeddingProperties}
     */
    public GoogleGenAiEmbeddingModel(Client client, RagEmbeddingProperties properties) {
        this.client = client;
        this.model = properties.getModel();
        this.outputDimensionality = properties.getOutputDimensionality();
        // 출력 차원 수가 지정된 경우 AbstractEmbeddingModel의 embeddingDimensions 필드를 업데이트
        if (this.outputDimensionality != null && this.outputDimensionality > 0) {
            this.embeddingDimensions.set(this.outputDimensionality);
        }
    }

    /**
     * {@link EmbeddingRequest}를 받아 Google GenAI 서비스에 임베딩을 요청하고,
     * 그 결과를 Spring AI의 {@link EmbeddingResponse} 형식으로 반환합니다.
     *
     * @param request 임베딩 요청 객체 (입력 텍스트 포함)
     * @return Google GenAI로부터 받은 임베딩 결과
     */
    @Override
    public EmbeddingResponse call(EmbeddingRequest request) {
        List<String> inputs = request.getInstructions();
        if (inputs == null || inputs.isEmpty()) {
            return new EmbeddingResponse(List.of());
        }

        EmbedContentConfig.Builder configBuilder = EmbedContentConfig.builder();
        if (outputDimensionality != null && outputDimensionality > 0) {
            configBuilder.outputDimensionality(outputDimensionality); // 출력 차원 수 설정
        }

        // Google GenAI 클라이언트를 통해 임베딩 요청
        EmbedContentResponse response = client.models.embedContent(model, inputs, configBuilder.build());
        List<ContentEmbedding> embeddings = response.embeddings().orElse(List.of());

        // Google GenAI 응답을 Spring AI Embedding 객체 리스트로 변환
        List<Embedding> results = new ArrayList<>();
        for (int index = 0; index < embeddings.size(); index++) {
            ContentEmbedding embedding = embeddings.get(index);
            List<Float> values = embedding.values().orElse(List.of());
            results.add(new Embedding(toFloatArray(values), index)); // Spring AI Embedding 객체 생성
        }

        return new EmbeddingResponse(results);
    }

    /**
     * {@link Document}의 콘텐츠에 대한 임베딩을 생성합니다.
     *
     * @param document 임베딩을 생성할 문서
     * @return 문서 콘텐츠의 임베딩 벡터
     */
    @Override
    public float[] embed(Document document) {
        return embed(document.getContent());
    }

    /**
     * {@code List<Float>} 형태의 벡터 값을 {@code float[]} 배열로 변환합니다.
     * Spring AI의 {@link Embedding} 객체 생성에 필요합니다.
     *
     * @param values List<Float> 형태의 벡터 값
     * @return float[] 배열로 변환된 벡터 값
     */
    private float[] toFloatArray(List<Float> values) {
        float[] vector = new float[values.size()];
        for (int i = 0; i < values.size(); i++) {
            Float value = values.get(i);
            vector[i] = value == null ? 0.0f : value; // null 값 처리
        }
        return vector;
    }
}
