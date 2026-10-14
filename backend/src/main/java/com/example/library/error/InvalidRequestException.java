package com.example.library.error;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/** A request parameter failed validation; {@code errors} maps parameter name to message. */
public class InvalidRequestException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    // Concrete Serializable type on purpose: exceptions are Serializable (SpotBugs SE_BAD_FIELD) and order matters.
    @SuppressWarnings("PMD.LooseCoupling")
    private final LinkedHashMap<String, String> errors;

    public InvalidRequestException(Map<String, String> errors) {
        super("Invalid request parameters");
        this.errors = new LinkedHashMap<>(errors);
    }

    public Map<String, String> getErrors() {
        return Collections.unmodifiableMap(errors);
    }
}
