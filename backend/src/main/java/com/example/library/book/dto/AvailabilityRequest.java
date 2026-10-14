package com.example.library.book.dto;

import jakarta.validation.constraints.NotNull;

/** Body of {@code PATCH /api/books/{id}/availability}. */
public record AvailabilityRequest(@NotNull Boolean available) {
}
