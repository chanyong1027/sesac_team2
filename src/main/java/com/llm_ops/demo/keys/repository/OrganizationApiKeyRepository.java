package com.llm_ops.demo.keys.repository;

import com.llm_ops.demo.keys.domain.OrganizationApiKey;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * {@link OrganizationApiKey} 엔티티에 대한 데이터 액세스 작업을 처리하는 Spring Data JPA 리포지토리입니다.
 */
public interface OrganizationApiKeyRepository extends JpaRepository<OrganizationApiKey, Long> {

    /**
     * 지정된 조직 내에 동일한 이름의 API 키가 존재하는지 확인합니다.
     *
     * @param organizationId 확인할 조직의 ID
     * @param name           확인할 API 키의 이름
     * @return 존재하면 true, 그렇지 않으면 false
     */
    boolean existsByOrganizationIdAndName(Long organizationId, String name);

    /**
     * 지정된 조직에 속한 모든 API 키를 조회합니다.
     *
     * @param organizationId 조회할 조직의 ID
     * @return 해당 조직의 API 키 엔티티 리스트
     */
    List<OrganizationApiKey> findAllByOrganizationId(Long organizationId);
}
