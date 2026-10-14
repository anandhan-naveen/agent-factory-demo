package com.example.library.book.dto;

import com.example.library.book.Genre;
import com.example.library.validation.Isbn13;
import com.example.library.validation.PublishedYear;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Request body for create (POST) and replace (PUT). String fields are trimmed before validation. */
public record BookInput(
        @NotBlank @Size(max = 200) String title,
        @NotBlank @Size(max = 120) String author,
        @NotBlank @Isbn13 String isbn,
        @NotNull @Min(1450) @PublishedYear Integer publishedYear,
        @NotNull Genre genre) {

    public BookInput {
        title = strip(title);
        author = strip(author);
        isbn = strip(isbn);
    }

    private static String strip(String value) {
        return value == null ? null : value.strip();
    }
}
