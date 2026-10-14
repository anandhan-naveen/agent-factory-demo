package com.example.library.book.dto;

import com.example.library.book.Book;
import com.example.library.book.Genre;
import java.time.Instant;
import java.util.UUID;

public record BookResponse(
        UUID id,
        String title,
        String author,
        String isbn,
        int publishedYear,
        Genre genre,
        boolean available,
        Instant createdAt) {

    public static BookResponse from(Book book) {
        return new BookResponse(
                book.getId(),
                book.getTitle(),
                book.getAuthor(),
                book.getIsbn(),
                book.getPublishedYear(),
                book.getGenre(),
                book.isAvailable(),
                book.getCreatedAt());
    }
}
