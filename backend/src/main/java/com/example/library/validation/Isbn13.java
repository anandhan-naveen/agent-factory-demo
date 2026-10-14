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

/** The annotated string must be 13 digits with a valid ISBN-13 check digit. {@code null} is valid. */
@Documented
@Constraint(validatedBy = Isbn13Validator.class)
@Target({FIELD, METHOD, PARAMETER, ANNOTATION_TYPE})
@Retention(RUNTIME)
public @interface Isbn13 {

    String message() default "must be a valid ISBN-13 (13 digits with a correct check digit)";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
