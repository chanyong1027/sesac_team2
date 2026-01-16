package com.llm_ops.demo.auth.repository;

import com.llm_ops.demo.auth.domain.User;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByName(String name);

    boolean existsByName(String name);

    boolean existsByEmail(String email);
}
