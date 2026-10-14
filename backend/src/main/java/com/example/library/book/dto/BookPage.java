package com.example.library.book.dto;

import java.util.List;

public record BookPage(List<BookResponse> items, int page, int size, long totalItems, int totalPages) {

    public BookPage {
        items = items == null ? List.of() : List.copyOf(items);
    }
}
