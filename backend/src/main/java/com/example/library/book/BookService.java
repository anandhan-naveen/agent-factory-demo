package com.example.library.book;

import com.example.library.book.dto.BookInput;
import com.example.library.book.dto.BookPage;
import com.example.library.book.dto.BookResponse;
import com.example.library.error.BookNotFoundException;
import com.example.library.error.DuplicateIsbnException;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookService {

    /** Title ascending, case-insensitive; id as a tie-breaker so paging is stable. */
    static final Sort DEFAULT_SORT = Sort.by(Sort.Order.asc("title").ignoreCase(), Sort.Order.asc("id"));

    private final BookRepository repository;
    private final Clock clock;

    public BookService(BookRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public BookPage search(String q, Genre genre, Boolean available, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, DEFAULT_SORT);
        Page<Book> result = repository.findAll(BookSpecifications.matching(q, genre, available), pageable);
        List<BookResponse> items = result.getContent().stream().map(BookResponse::from).toList();
        return new BookPage(items, result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public BookResponse get(UUID id) {
        return BookResponse.from(find(id));
    }

    @Transactional
    public BookResponse create(BookInput input) {
        if (repository.existsByIsbn(input.isbn())) {
            throw new DuplicateIsbnException(input.isbn());
        }
        Book book = new Book(
                input.title(),
                input.author(),
                input.isbn(),
                input.publishedYear(),
                input.genre(),
                Instant.now(clock));
        return BookResponse.from(repository.saveAndFlush(book));
    }

    @Transactional
    public BookResponse update(UUID id, BookInput input) {
        Book book = find(id);
        if (repository.existsByIsbnAndIdNot(input.isbn(), id)) {
            throw new DuplicateIsbnException(input.isbn());
        }
        book.update(input.title(), input.author(), input.isbn(), input.publishedYear(), input.genre());
        return BookResponse.from(repository.saveAndFlush(book));
    }

    @Transactional
    public BookResponse setAvailability(UUID id, boolean available) {
        Book book = find(id);
        book.setAvailable(available);
        return BookResponse.from(repository.saveAndFlush(book));
    }

    @Transactional
    public void delete(UUID id) {
        repository.delete(find(id));
    }

    private Book find(UUID id) {
        return repository.findById(id).orElseThrow(() -> new BookNotFoundException(id.toString()));
    }
}
