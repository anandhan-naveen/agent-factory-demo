package com.example.library.config;

import com.example.library.book.Book;
import com.example.library.book.BookRepository;
import com.example.library.book.Genre;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Seeds the in-memory catalog with sample books (all ISBN-13 checksums verified). */
@Component
@ConditionalOnProperty(name = "app.seed.enabled", havingValue = "true", matchIfMissing = true)
public class DataSeeder implements ApplicationRunner {

    private final BookRepository repository;
    private final Clock clock;

    public DataSeeder(BookRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (repository.count() > 0) {
            return;
        }
        Instant now = Instant.now(clock);
        Book nineteenEightyFour = new Book("1984", "George Orwell", "9780451524935", 1949, Genre.FICTION, now);
        nineteenEightyFour.setAvailable(false);
        Book cleanCode = new Book("Clean Code", "Robert C. Martin", "9780132350884", 2008, Genre.TECHNOLOGY, now);
        cleanCode.setAvailable(false);
        repository.saveAll(List.of(
                new Book("The Great Gatsby", "F. Scott Fitzgerald", "9780743273565", 1925, Genre.FICTION, now),
                new Book("To Kill a Mockingbird", "Harper Lee", "9780061120084", 1960, Genre.FICTION, now),
                nineteenEightyFour,
                cleanCode,
                new Book("A Brief History of Time", "Stephen Hawking", "9780553380163", 1988, Genre.SCIENCE, now),
                new Book("Sapiens: A Brief History of Humankind", "Yuval Noah Harari", "9780062316097", 2014,
                        Genre.HISTORY, now),
                new Book("Charlotte's Web", "E. B. White", "9780064400558", 1952, Genre.CHILDREN, now),
                new Book("Thinking, Fast and Slow", "Daniel Kahneman", "9780374533557", 2011, Genre.NON_FICTION,
                        now)));
    }
}
