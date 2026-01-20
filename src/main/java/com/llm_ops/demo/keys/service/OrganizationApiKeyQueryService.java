package com.llm_ops.demo.keys.service;

import com.llm_ops.demo.keys.dto.OrganizationApiKeySummaryResponse;
import com.llm_ops.demo.keys.repository.OrganizationApiKeyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class OrganizationApiKeyQueryService {

    private final OrganizationApiKeyRepository organizationApiKeyRepository;

    @Transactional(readOnly = true)
    public List<OrganizationApiKeySummaryResponse> getOrganizationApiKeys(Long organizationId) {
        return organizationApiKeyRepository.findAllByOrganizationId(organizationId).stream()
                .map(OrganizationApiKeySummaryResponse::from)
                .toList();
    }
}

