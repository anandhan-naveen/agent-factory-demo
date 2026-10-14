package com.example.library.book;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Objects;
import java.util.UUID;
import org.hibernate.annotations.DynamicUpdate;

/**
 * {@code @DynamicUpdate}: an UPDATE writes only the columns that changed, so a PUT that loaded the row before a
 * concurrent PATCH committed does not overwrite {@code available} with its stale value (BE-AC7).
 */
@Entity
@DynamicUpdate
@Table(name = "books", uniqueConstraints = @UniqueConstraint(name = "uk_books_isbn", columnNames = "isbn"))
public class Book {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 120)
    private String author;

    @Column(nullable = false, length = 13)
    private String isbn;

    @Column(name = "published_year", nullable = false)
    private int publishedYear;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Genre genre;

    @Column(nullable = false)
    private boolean available;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** Required by JPA. */
    protected Book() {
        // Intentionally empty: JPA populates fields reflectively.
    }

    /**
     * {@code createdAt} is truncated to milliseconds so the value returned by POST is exactly the value the database
     * stores and returns on later reads (the system clock has nanosecond precision; the column has microseconds).
     */
    public Book(String title, String author, String isbn, int publishedYear, Genre genre, Instant createdAt) {
        this.title = title;
        this.author = author;
        this.isbn = isbn;
        this.publishedYear = publishedYear;
        this.genre = genre;
        this.available = true;
        this.createdAt = Objects.requireNonNull(createdAt, "createdAt").truncatedTo(ChronoUnit.MILLIS);
    }

    /** Replaces every editable field (PUT semantics). Availability and creation time are untouched. */
    public void update(String title, String author, String isbn, int publishedYear, Genre genre) {
        this.title = title;
        this.author = author;
        this.isbn = isbn;
        this.publishedYear = publishedYear;
        this.genre = genre;
    }

    public UUID getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public String getAuthor() {
        return author;
    }

    public String getIsbn() {
        return isbn;
    }

    public int getPublishedYear() {
        return publishedYear;
    }

    public Genre getGenre() {
        return genre;
    }

    public boolean isAvailable() {
        return available;
    }

    public void setAvailable(boolean available) {
        this.available = available;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
