package com.example.library.book;

import com.example.library.book.dto.AvailabilityRequest;
import com.example.library.book.dto.BookInput;
import com.example.library.book.dto.BookPage;
import com.example.library.book.dto.BookResponse;
import com.example.library.error.BookNotFoundException;
import com.example.library.error.InvalidRequestException;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/books")
public class BookController {

    static final int MAX_PAGE_SIZE = 100;
    static final int MAX_QUERY_LENGTH = 200;

    private final BookService service;

    public BookController(BookService service) {
        this.service = service;
    }

    @GetMapping
    public BookPage list(
            @RequestParam(name = "q", required = false) String q,
            @RequestParam(name = "genre", required = false) Genre genre,
            @RequestParam(name = "available", required = false) Boolean available,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size) {
        Map<String, String> errors = new LinkedHashMap<>();
        if (page < 0) {
            errors.put("page", "must be greater than or equal to 0");
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            errors.put("size", "must be between 1 and " + MAX_PAGE_SIZE);
        }
        if (page >= 0 && size >= 1 && size <= MAX_PAGE_SIZE && (long) page * size > Integer.MAX_VALUE) {
            // The row offset (page * size) must fit in an int for the JPA query; beyond that is a client error.
            errors.put("page", "is too large for the requested size");
        }
        if (q != null && q.length() > MAX_QUERY_LENGTH) {
            errors.put("q", "size must be at most " + MAX_QUERY_LENGTH);
        }
        if (!errors.isEmpty()) {
            throw new InvalidRequestException(errors);
        }
        return service.search(q, genre, available, page, size);
    }

    @GetMapping("/{id}")
    public BookResponse get(@PathVariable("id") String id) {
        return service.get(parseId(id));
    }

    @PostMapping
    public ResponseEntity<BookResponse> create(@Valid @RequestBody BookInput input) {
        BookResponse created = service.create(input);
        return ResponseEntity.created(URI.create("/api/books/" + created.id())).body(created);
    }

    @PutMapping("/{id}")
    public BookResponse update(@PathVariable("id") String id, @Valid @RequestBody BookInput input) {
        return service.update(parseId(id), input);
    }

    @PatchMapping("/{id}/availability")
    public BookResponse setAvailability(@PathVariable("id") String id, @Valid @RequestBody AvailabilityRequest request) {
        return service.setAvailability(parseId(id), request.available());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable("id") String id) {
        service.delete(parseId(id));
        return ResponseEntity.noContent().build();
    }

    /** A malformed id cannot identify any book, so it is reported as 404 rather than 400/500. */
    @SuppressWarnings("PMD.PreserveStackTrace") // expected input error; the parse trace has no diagnostic value
    static UUID parseId(String id) {
        try {
            return UUID.fromString(id);
        } catch (IllegalArgumentException ex) {
            throw new BookNotFoundException(id);
        }
    }
}
