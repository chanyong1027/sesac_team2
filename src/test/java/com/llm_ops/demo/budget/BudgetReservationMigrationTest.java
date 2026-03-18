package com.llm_ops.demo.budget;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.EncodedResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;

import static org.assertj.core.api.Assertions.assertThat;

class BudgetReservationMigrationTest {

    @Test
    @DisplayName("예산 reservation migration을 적용한다")
    void 예산_reservation_migration을_적용한다() throws Exception {
        // given
        String url =
            "jdbc:h2:mem:budgetreservationmigration;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE"
                + ";INIT=CREATE DOMAIN IF NOT EXISTS TIMESTAMPTZ AS TIMESTAMP WITH TIME ZONE";

        try (Connection connection = DriverManager.getConnection(url, "sa", "")) {
            ScriptUtils.executeSqlScript(connection, new EncodedResource(new ClassPathResource("db/migration/V19__budget_policies_and_usage.sql")));

            // when
            ScriptUtils.executeSqlScript(connection, new EncodedResource(new ClassPathResource("db/migration/V33__budget_reservations.sql")));

            try (
                PreparedStatement usageInsert = connection.prepareStatement(
                    """
                        INSERT INTO budget_monthly_usage (
                            scope_type,
                            scope_id,
                            year_month,
                            cost_usd,
                            total_tokens,
                            request_count,
                            reserved_cost_usd
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                        """
                );
                PreparedStatement reservationInsert = connection.prepareStatement(
                    """
                        INSERT INTO budget_reservations (
                            trace_id,
                            scope_type,
                            scope_id,
                            year_month,
                            provider,
                            model,
                            reserved_cost_usd,
                            status,
                            expires_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """
                );
                PreparedStatement reservedQuery = connection.prepareStatement(
                    "SELECT reserved_cost_usd FROM budget_monthly_usage WHERE scope_type = ? AND scope_id = ? AND year_month = ?"
                )
            ) {
                usageInsert.setString(1, "WORKSPACE");
                usageInsert.setLong(2, 7L);
                usageInsert.setInt(3, 202603);
                usageInsert.setBigDecimal(4, new java.math.BigDecimal("1.25"));
                usageInsert.setLong(5, 500L);
                usageInsert.setLong(6, 2L);
                usageInsert.setBigDecimal(7, new java.math.BigDecimal("0.75"));
                usageInsert.executeUpdate();

                reservationInsert.setString(1, "trace-001");
                reservationInsert.setString(2, "WORKSPACE");
                reservationInsert.setLong(3, 7L);
                reservationInsert.setInt(4, 202603);
                reservationInsert.setString(5, "openai");
                reservationInsert.setString(6, "gpt-4.1-mini");
                reservationInsert.setBigDecimal(7, new java.math.BigDecimal("0.75"));
                reservationInsert.setString(8, "RESERVED");
                reservationInsert.setObject(9, OffsetDateTime.now().plusMinutes(1));
                reservationInsert.executeUpdate();

                // then
                reservedQuery.setString(1, "WORKSPACE");
                reservedQuery.setLong(2, 7L);
                reservedQuery.setInt(3, 202603);

                try (ResultSet resultSet = reservedQuery.executeQuery()) {
                    assertThat(resultSet.next()).isTrue();
                    assertThat(resultSet.getBigDecimal(1)).isEqualByComparingTo("0.75");
                }
            }
        }
    }
}
