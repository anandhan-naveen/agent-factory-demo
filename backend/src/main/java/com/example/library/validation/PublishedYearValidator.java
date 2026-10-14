package com.example.library.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.time.Clock;
import java.time.Year;

/** Instantiated by Spring's constraint validator factory, so the {@link Clock} bean is constructor-injected. */
public class PublishedYearValidator implements ConstraintValidator<PublishedYear, Integer> {

    private final Clock clock;

    public PublishedYearValidator(Clock clock) {
        this.clock = clock;
    }

    @Override
    public boolean isValid(Integer value, ConstraintValidatorContext context) {
        if (value == null) {
            return true;
        }
        return value <= Year.now(clock).getValue();
    }
}
