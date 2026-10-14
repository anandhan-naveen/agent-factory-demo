package com.example.library.validation;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class PublishedYearValidatorTest {

    private final PublishedYearValidator validator =
            new PublishedYearValidator(Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneOffset.UTC));

    @Test
    void acceptsCurrentYear() {
        assertThat(validator.isValid(2026, null)).isTrue();
    }

    @Test
    void acceptsPastYear() {
        assertThat(validator.isValid(1450, null)).isTrue();
    }

    @Test
    void rejectsFutureYear() {
        assertThat(validator.isValid(2027, null)).isFalse();
    }

    @Test
    void treatsNullAsValid() {
        assertThat(validator.isValid(null, null)).isTrue();
    }
}
