package com.example.library.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class Isbn13Validator implements ConstraintValidator<Isbn13, String> {

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null) {
            return true; // presence is enforced by @NotBlank / @NotNull
        }
        return IsbnChecksum.isValid(value);
    }
}
