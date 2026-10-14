package com.example.library.error;

public class BookNotFoundException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public BookNotFoundException(String id) {
        super("No book found with id '" + id + "'");
    }
}
