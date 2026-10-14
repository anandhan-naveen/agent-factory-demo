package com.example.library.error;

import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import com.fasterxml.jackson.databind.exc.MismatchedInputException;
import com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.TypeMismatchException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Maps every error to RFC 7807 {@code application/problem+json}. Responses never contain stack
 * traces, exception class names or raw parser messages.
 */
@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

    public static final String VALIDATION_FAILED = "Validation failed";
    public static final String BOOK_NOT_FOUND = "Book not found";
    public static final String DUPLICATE_ISBN = "Duplicate ISBN";
    public static final String INTERNAL_ERROR = "Internal Server Error";

    private static final Logger LOG = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(BookNotFoundException.class)
    public ResponseEntity<ProblemDetail> handleNotFound(BookNotFoundException ex) {
        return problem(HttpStatus.NOT_FOUND, BOOK_NOT_FOUND, ex.getMessage(), null);
    }

    @ExceptionHandler(DuplicateIsbnException.class)
    public ResponseEntity<ProblemDetail> handleDuplicate(DuplicateIsbnException ex) {
        return problem(HttpStatus.CONFLICT, DUPLICATE_ISBN, ex.getMessage(), null);
    }

    /** Safety net for the race where two requests insert the same ISBN concurrently. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ProblemDetail> handleDataIntegrity(DataIntegrityViolationException ex) {
        return problem(HttpStatus.CONFLICT, DUPLICATE_ISBN, "A book with this ISBN already exists", null);
    }

    @ExceptionHandler(InvalidRequestException.class)
    public ResponseEntity<ProblemDetail> handleInvalidRequest(InvalidRequestException ex) {
        return problem(HttpStatus.BAD_REQUEST, VALIDATION_FAILED, "One or more request parameters are invalid",
                ex.getErrors());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetail> handleUnexpected(Exception ex) {
        LOG.error("Unhandled error", ex);
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, INTERNAL_ERROR, "An unexpected error occurred", null);
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        Map<String, String> errors = new LinkedHashMap<>();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            String message = fieldError.getDefaultMessage() == null ? "is invalid" : fieldError.getDefaultMessage();
            errors.putIfAbsent(fieldError.getField(), message);
        }
        ex.getBindingResult().getGlobalErrors().forEach(globalError ->
                errors.putIfAbsent(globalError.getObjectName(),
                        globalError.getDefaultMessage() == null ? "is invalid" : globalError.getDefaultMessage()));
        return asObject(problem(HttpStatus.BAD_REQUEST, VALIDATION_FAILED, "Request body has invalid fields", errors));
    }

    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(
            HttpMessageNotReadableException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        Map<String, String> errors = new LinkedHashMap<>();
        String detail = "Request body is missing or is not valid JSON";
        Throwable cause = ex.getCause();
        if (cause instanceof UnrecognizedPropertyException unknown) {
            errors.put(unknown.getPropertyName(), "unknown field");
            detail = "Request body contains an unknown field";
        } else if (cause instanceof InvalidFormatException invalid && invalid.getTargetType() != null
                && invalid.getTargetType().isEnum()) {
            String allowed = Arrays.stream(invalid.getTargetType().getEnumConstants())
                    .map(Object::toString)
                    .collect(Collectors.joining(", "));
            errors.put(path(invalid), "must be one of: " + allowed);
            detail = "Request body has invalid fields";
        } else if (cause instanceof MismatchedInputException mismatched && !mismatched.getPath().isEmpty()) {
            errors.put(path(mismatched), "has an invalid type or format");
            detail = "Request body has invalid fields";
        }
        return asObject(problem(HttpStatus.BAD_REQUEST, VALIDATION_FAILED, detail, errors));
    }

    @Override
    protected ResponseEntity<Object> handleTypeMismatch(
            TypeMismatchException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        String name = ex instanceof MethodArgumentTypeMismatchException mismatch
                ? mismatch.getName()
                : Objects.requireNonNullElse(ex.getPropertyName(), "parameter");
        Class<?> requiredType = ex.getRequiredType();
        String message;
        if (requiredType != null && requiredType.isEnum()) {
            message = "must be one of: " + Arrays.stream(requiredType.getEnumConstants())
                    .map(Object::toString)
                    .collect(Collectors.joining(", "));
        } else if (requiredType == Boolean.class || requiredType == boolean.class) {
            message = "must be true or false";
        } else if (requiredType == Integer.class || requiredType == int.class) {
            message = "must be an integer";
        } else {
            message = "has an invalid value";
        }
        return asObject(problem(HttpStatus.BAD_REQUEST, VALIDATION_FAILED, "One or more request parameters are invalid",
                Map.of(name, message)));
    }

    private static String path(JsonMappingException ex) {
        String joined = ex.getPath().stream()
                .map(ref -> ref.getFieldName() != null ? ref.getFieldName() : "[" + ref.getIndex() + "]")
                .collect(Collectors.joining("."));
        return joined.isEmpty() ? "body" : joined;
    }

    private static ResponseEntity<ProblemDetail> problem(
            HttpStatus status, String title, String detail, Map<String, String> errors) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(status, detail);
        body.setTitle(title);
        if (errors != null) {
            body.setProperty("errors", errors);
        }
        return ResponseEntity.status(status).body(body);
    }

    private static ResponseEntity<Object> asObject(ResponseEntity<ProblemDetail> response) {
        return ResponseEntity.status(response.getStatusCode()).body(response.getBody());
    }
}
