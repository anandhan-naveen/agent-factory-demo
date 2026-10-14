package com.example.library.book;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

@DataJpaTest
class BookRepositoryTest {

    private static final Instant NOW = Instant.parse("2026-10-14T09:00:00Z");

    private final BookRepository repository;

    private Book gatsby;

    @Autowired
    BookRepositoryTest(BookRepository repository) {
        this.repository = repository;
    }

    @BeforeEach
    void seed() {
        gatsby = new Book("The Great Gatsby", "F. Scott Fitzgerald", "9780743273565", 1925, Genre.FICTION, NOW);
        Book orwell = new Book("1984", "George Orwell", "9780451524935", 1949, Genre.FICTION, NOW);
        orwell.setAvailable(false);
        Book cleanCode = new Book("clean code", "Robert C. Martin", "9780132350884", 2008, Genre.TECHNOLOGY, NOW);
        Book hawking = new Book("A Brief History of Time", "Stephen Hawking", "9780553380163", 1988, Genre.SCIENCE,
                NOW);
        Book sapiens = new Book("Sapiens", "Yuval Noah Harari", "9780062316097", 2014, Genre.HISTORY, NOW);
        sapiens.setAvailable(false);
        gatsby = repository.save(gatsby);
        repository.saveAll(List.of(orwell, cleanCode, hawking, sapiens));
        repository.flush();
    }

    private List<String> titles(String q, Genre genre, Boolean available) {
        Page<Book> page = repository.findAll(BookSpecifications.matching(q, genre, available),
                PageRequest.of(0, 20, BookService.DEFAULT_SORT));
        return page.getContent().stream().map(Book::getTitle).toList();
    }

    @Test
    void noFiltersReturnsAllSortedByTitleIgnoringCase() {
        assertThat(titles(null, null, null))
                .containsExactly("1984", "A Brief History of Time", "clean code", "Sapiens", "The Great Gatsby");
    }

    @Test
    void qMatchesTitleCaseInsensitively() {
        assertThat(titles("gREAT", null, null)).containsExactly("The Great Gatsby");
    }

    @Test
    void qMatchesAuthorCaseInsensitively() {
        assertThat(titles("orwell", null, null)).containsExactly("1984");
    }

    @Test
    void qMatchesSubstringInEitherTitleOrAuthor() {
        assertThat(titles("history", null, null)).containsExactly("A Brief History of Time");
        assertThat(titles("  martin ", null, null)).containsExactly("clean code");
    }

    @Test
    void blankQIsIgnored() {
        assertThat(titles("   ", null, null)).hasSize(5);
    }

    @Test
    void likeWildcardsAreTreatedLiterally() {
        assertThat(titles("%", null, null)).isEmpty();
        assertThat(titles("_", null, null)).isEmpty();
    }

    @Test
    void genreFiltersByExactValue() {
        assertThat(titles(null, Genre.FICTION, null)).containsExactly("1984", "The Great Gatsby");
        assertThat(titles(null, Genre.CHILDREN, null)).isEmpty();
    }

    @Test
    void availableFilters() {
        assertThat(titles(null, null, false)).containsExactly("1984", "Sapiens");
        assertThat(titles(null, null, true)).containsExactly("A Brief History of Time", "clean code", "The Great Gatsby");
    }

    @Test
    void filtersCombine() {
        assertThat(titles("e", Genre.FICTION, true)).containsExactly("The Great Gatsby");
        assertThat(titles("orwell", Genre.FICTION, true)).isEmpty();
    }

    @Test
    void pagingReportsTotals() {
        Page<Book> page = repository.findAll(BookSpecifications.matching(null, null, null),
                PageRequest.of(1, 2, BookService.DEFAULT_SORT));
        assertThat(page.getTotalElements()).isEqualTo(5);
        assertThat(page.getTotalPages()).isEqualTo(3);
        assertThat(page.getContent()).extracting(Book::getTitle).containsExactly("clean code", "Sapiens");
    }

    @Test
    void persistsGeneratedIdAndFields() {
        Book found = repository.findById(gatsby.getId()).orElseThrow();
        assertThat(found.getId()).isNotNull();
        assertThat(found.getAuthor()).isEqualTo("F. Scott Fitzgerald");
        assertThat(found.getIsbn()).isEqualTo("9780743273565");
        assertThat(found.getPublishedYear()).isEqualTo(1925);
        assertThat(found.getGenre()).isEqualTo(Genre.FICTION);
        assertThat(found.isAvailable()).isTrue();
        assertThat(found.getCreatedAt()).isEqualTo(NOW);
    }

    @Test
    void existsByIsbnQueries() {
        assertThat(repository.existsByIsbn("9780743273565")).isTrue();
        assertThat(repository.existsByIsbn("9780064400558")).isFalse();
        assertThat(repository.existsByIsbnAndIdNot("9780743273565", gatsby.getId())).isFalse();
        assertThat(repository.existsByIsbnAndIdNot("9780451524935", gatsby.getId())).isTrue();
    }

    @Test
    void uniqueIsbnIsEnforcedByTheDatabase() {
        Book duplicate = new Book("Copy", "Someone", "9780743273565", 2000, Genre.FICTION, NOW);
        assertThatThrownBy(() -> repository.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
