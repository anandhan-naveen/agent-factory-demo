package com.example.library.book;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.library.book.dto.BookInput;
import com.example.library.book.dto.BookPage;
import com.example.library.book.dto.BookResponse;
import com.example.library.error.BookNotFoundException;
import com.example.library.error.DuplicateIsbnException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class BookServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-14T09:00:00Z");
    private static final UUID ID = UUID.fromString("11111111-2222-3333-4444-555555555555");
    private static final BookInput INPUT =
            new BookInput("  The Great Gatsby ", " F. Scott Fitzgerald ", "9780743273565", 1925, Genre.FICTION);

    @Mock
    private BookRepository repository;

    private BookService service;

    @BeforeEach
    void setUp() {
        service = new BookService(repository, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private static Book book(UUID id, String title, String isbn) {
        Book book = new Book(title, "Author", isbn, 2000, Genre.FICTION, NOW);
        ReflectionTestUtils.setField(book, "id", id);
        return book;
    }

    @Test
    void inputIsTrimmed() {
        assertThat(INPUT.title()).isEqualTo("The Great Gatsby");
        assertThat(INPUT.author()).isEqualTo("F. Scott Fitzgerald");
    }

    @Test
    void createSavesAvailableBookWithCreationTime() {
        when(repository.existsByIsbn("9780743273565")).thenReturn(false);
        when(repository.saveAndFlush(any(Book.class))).thenAnswer(invocation -> {
            Book saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", ID);
            return saved;
        });

        BookResponse response = service.create(INPUT);

        assertThat(response.id()).isEqualTo(ID);
        assertThat(response.title()).isEqualTo("The Great Gatsby");
        assertThat(response.author()).isEqualTo("F. Scott Fitzgerald");
        assertThat(response.isbn()).isEqualTo("9780743273565");
        assertThat(response.publishedYear()).isEqualTo(1925);
        assertThat(response.genre()).isEqualTo(Genre.FICTION);
        assertThat(response.available()).isTrue();
        assertThat(response.createdAt()).isEqualTo(NOW);
    }

    @Test
    void createRejectsDuplicateIsbn() {
        when(repository.existsByIsbn("9780743273565")).thenReturn(true);

        assertThatThrownBy(() -> service.create(INPUT))
                .isInstanceOf(DuplicateIsbnException.class)
                .hasMessageContaining("9780743273565");
        verify(repository, never()).saveAndFlush(any(Book.class));
    }

    @Test
    void getReturnsBook() {
        when(repository.findById(ID)).thenReturn(Optional.of(book(ID, "Dune", "9780441013593")));

        assertThat(service.get(ID).title()).isEqualTo("Dune");
    }

    @Test
    void getUnknownThrowsNotFound() {
        when(repository.findById(ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(ID)).isInstanceOf(BookNotFoundException.class);
    }

    @Test
    void updateReplacesEditableFieldsButKeepsAvailabilityAndCreatedAt() {
        Book existing = book(ID, "Old title", "9780441013593");
        existing.setAvailable(false);
        when(repository.findById(ID)).thenReturn(Optional.of(existing));
        when(repository.existsByIsbnAndIdNot("9780743273565", ID)).thenReturn(false);
        when(repository.saveAndFlush(existing)).thenReturn(existing);

        BookResponse response = service.update(ID, INPUT);

        assertThat(response.title()).isEqualTo("The Great Gatsby");
        assertThat(response.isbn()).isEqualTo("9780743273565");
        assertThat(response.publishedYear()).isEqualTo(1925);
        assertThat(response.available()).isFalse();
        assertThat(response.createdAt()).isEqualTo(NOW);
    }

    @Test
    void updateRejectsIsbnOfAnotherBook() {
        when(repository.findById(ID)).thenReturn(Optional.of(book(ID, "Old", "9780441013593")));
        when(repository.existsByIsbnAndIdNot("9780743273565", ID)).thenReturn(true);

        assertThatThrownBy(() -> service.update(ID, INPUT)).isInstanceOf(DuplicateIsbnException.class);
        verify(repository, never()).saveAndFlush(any(Book.class));
    }

    @Test
    void updateUnknownThrowsNotFound() {
        when(repository.findById(ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.update(ID, INPUT)).isInstanceOf(BookNotFoundException.class);
    }

    @Test
    void setAvailabilityChangesOnlyAvailability() {
        Book existing = book(ID, "Dune", "9780441013593");
        when(repository.findById(ID)).thenReturn(Optional.of(existing));
        when(repository.saveAndFlush(existing)).thenReturn(existing);

        BookResponse response = service.setAvailability(ID, false);

        assertThat(response.available()).isFalse();
        assertThat(response.title()).isEqualTo("Dune");
        assertThat(response.isbn()).isEqualTo("9780441013593");
    }

    @Test
    void setAvailabilityUnknownThrowsNotFound() {
        when(repository.findById(ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.setAvailability(ID, true)).isInstanceOf(BookNotFoundException.class);
    }

    @Test
    void deleteRemovesBook() {
        Book existing = book(ID, "Dune", "9780441013593");
        when(repository.findById(ID)).thenReturn(Optional.of(existing));

        service.delete(ID);

        verify(repository).delete(existing);
    }

    @Test
    void deleteUnknownThrowsNotFound() {
        when(repository.findById(ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.delete(ID)).isInstanceOf(BookNotFoundException.class);
        verify(repository, never()).delete(any(Book.class));
    }

    @Test
    void searchMapsPageAndSortsByTitleIgnoringCase() {
        Book dune = book(ID, "Dune", "9780441013593");
        Pageable requested = PageRequest.of(1, 5, BookService.DEFAULT_SORT);
        when(repository.findAll(ArgumentMatchers.<Specification<Book>>any(), eq(requested)))
                .thenReturn(new PageImpl<>(List.of(dune), requested, 6));

        BookPage page = service.search("dune", Genre.FICTION, true, 1, 5);

        assertThat(page.items()).extracting(BookResponse::title).containsExactly("Dune");
        assertThat(page.page()).isEqualTo(1);
        assertThat(page.size()).isEqualTo(5);
        assertThat(page.totalItems()).isEqualTo(6);
        assertThat(page.totalPages()).isEqualTo(2);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(repository).findAll(ArgumentMatchers.<Specification<Book>>any(), pageable.capture());
        Sort.Order titleOrder = pageable.getValue().getSort().getOrderFor("title");
        assertThat(titleOrder).isNotNull();
        assertThat(titleOrder.isAscending()).isTrue();
        assertThat(titleOrder.isIgnoreCase()).isTrue();
    }
}
