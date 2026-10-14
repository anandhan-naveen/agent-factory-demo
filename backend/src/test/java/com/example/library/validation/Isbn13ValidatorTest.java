package com.example.library.validation;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class Isbn13ValidatorTest {

    private final Isbn13Validator validator = new Isbn13Validator();

    @ParameterizedTest
    @ValueSource(strings = {
        "9780743273565", "9780061120084", "9780451524935", "9780132350884",
        "9780553380163", "9780062316097", "9780064400558", "9780374533557"
    })
    void acceptsValidIsbn13(String isbn) {
        assertThat(validator.isValid(isbn, null)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"9780743273566", "9780743273560", "9780061120085"})
    void rejectsBadChecksum(String isbn) {
        assertThat(validator.isValid(isbn, null)).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"978074327356X", "97807432735a5", "978-0743273565", "978 074327356", "٩780743273565"})
    void rejectsNonDigits(String isbn) {
        assertThat(validator.isValid(isbn, null)).isFalse();
    }

    @Test
    void rejectsTwelveDigits() {
        assertThat(validator.isValid("978074327356", null)).isFalse();
    }

    @Test
    void rejectsFourteenDigits() {
        assertThat(validator.isValid("97807432735650", null)).isFalse();
    }

    @Test
    void rejectsEmptyString() {
        assertThat(validator.isValid("", null)).isFalse();
    }

    @Test
    void treatsNullAsValidSoThatNotBlankReportsIt() {
        assertThat(validator.isValid(null, null)).isTrue();
    }

    @Test
    void checksumHelperRejectsNull() {
        assertThat(IsbnChecksum.isValid(null)).isFalse();
    }

    @Test
    void handlesCheckDigitZero() {
        assertThat(IsbnChecksum.isValid("9780000000040")).isTrue();
        assertThat(IsbnChecksum.isValid("9780000000041")).isFalse();
    }
}
