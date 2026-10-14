package com.example.library.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class Isbn13Validator implements ConstraintValidator<Isbn13, String> {

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isBlank()) {
            return true; // presence is enforced by @NotBlank, so a blank ISBN reports exactly one message
        }
        return IsbnChecksum.isValid(value);
    }
}
