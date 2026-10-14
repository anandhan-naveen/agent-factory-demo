package com.example.library.validation;

import static java.lang.annotation.ElementType.ANNOTATION_TYPE;
import static java.lang.annotation.ElementType.FIELD;
import static java.lang.annotation.ElementType.METHOD;
import static java.lang.annotation.ElementType.PARAMETER;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;

/**
 * The annotated year must not be later than the current year, as given by the application's
 * {@link java.time.Clock} bean. {@code null} is valid.
 */
@Documented
@Constraint(validatedBy = PublishedYearValidator.class)
@Target({FIELD, METHOD, PARAMETER, ANNOTATION_TYPE})
@Retention(RUNTIME)
public @interface PublishedYear {

    String message() default "must not be later than the current year";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
