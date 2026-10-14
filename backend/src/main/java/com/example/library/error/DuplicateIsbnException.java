package com.example.library.error;

public class DuplicateIsbnException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public DuplicateIsbnException(String isbn) {
        super("A book with ISBN " + isbn + " already exists");
    }
}
