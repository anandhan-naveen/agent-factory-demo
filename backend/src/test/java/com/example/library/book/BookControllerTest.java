package com.example.library.book;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.library.book.dto.BookInput;
import com.example.library.book.dto.BookPage;
import com.example.library.book.dto.BookResponse;
import com.example.library.config.ClockConfig;
import com.example.library.config.JacksonConfig;
import com.example.library.error.BookNotFoundException;
import com.example.library.error.DuplicateIsbnException;
import java.time.Instant;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@WebMvcTest(BookController.class)
@Import({ClockConfig.class, JacksonConfig.class})
class BookControllerTest {

    private static final UUID ID = UUID.fromString("0b6c1e9a-3f4d-4a52-9d2e-1c2b3a4d5e6f");
    private static final Instant CREATED = Instant.parse("2026-10-14T09:00:00Z");
    private static final BookResponse GATSBY = new BookResponse(ID, "The Great Gatsby", "F. Scott Fitzgerald",
            "9780743273565", 1925, Genre.FICTION, true, CREATED);
    private static final String VALID_BODY = """
            {"title":"The Great Gatsby","author":"F. Scott Fitzgerald","isbn":"9780743273565",
             "publishedYear":1925,"genre":"FICTION"}
            """;

    private final MockMvc mvc;

    @MockBean
    private BookService service;

    @Autowired
    BookControllerTest(MockMvc mvc) {
        this.mvc = mvc;
    }

    private ResultActions perform(MockHttpServletRequestBuilder request) throws Exception {
        return mvc.perform(request);
    }

    private static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder builder, String body) {
        return builder.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private static ResultActions expectProblem(ResultActions result, int status, String title) throws Exception {
        return result.andExpect(status().is(status))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(status))
                .andExpect(jsonPath("$.title").value(title))
                .andExpect(content().string(not(containsString("Exception"))))
                .andExpect(content().string(not(containsString("trace"))));
    }

    // ---------- GET /api/books ----------

    @Test
    void listReturnsPageEnvelope() throws Exception {
        when(service.search(isNull(), isNull(), isNull(), eq(0), eq(20)))
                .thenReturn(new BookPage(List.of(GATSBY), 0, 20, 1, 1));

        perform(get("/api/books"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.items[0].id").value(ID.toString()))
                .andExpect(jsonPath("$.items[0].title").value("The Great Gatsby"))
                .andExpect(jsonPath("$.items[0].author").value("F. Scott Fitzgerald"))
                .andExpect(jsonPath("$.items[0].isbn").value("9780743273565"))
                .andExpect(jsonPath("$.items[0].publishedYear").value(1925))
                .andExpect(jsonPath("$.items[0].genre").value("FICTION"))
                .andExpect(jsonPath("$.items[0].available").value(true))
                .andExpect(jsonPath("$.items[0].createdAt").value("2026-10-14T09:00:00Z"))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.totalPages").value(1));
    }

    @Test
    void listPassesAllFilters() throws Exception {
        when(service.search("gats", Genre.FICTION, true, 2, 100)).thenReturn(new BookPage(List.of(), 2, 100, 0, 0));

        perform(get("/api/books").param("q", "gats").param("genre", "FICTION").param("available", "true")
                .param("page", "2").param("size", "100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());
        verify(service).search("gats", Genre.FICTION, true, 2, 100);
    }

    @Test
    void listRejectsSizeOver100() throws Exception {
        expectProblem(perform(get("/api/books").param("size", "101")), 400, "Validation failed")
                .andExpect(jsonPath("$.errors.size").value("must be between 1 and 100"));
        verifyNoInteractions(service);
    }

    @Test
    void listRejectsSizeZeroAndNegativePage() throws Exception {
        expectProblem(perform(get("/api/books").param("size", "0").param("page", "-1")), 400, "Validation failed")
                .andExpect(jsonPath("$.errors.size").exists())
                .andExpect(jsonPath("$.errors.page").exists());
        verifyNoInteractions(service);
    }

    @Test
    void listRejectsOverlongQuery() throws Exception {
        expectProblem(perform(get("/api/books").param("q", "x".repeat(201))), 400, "Validation failed");
        verifyNoInteractions(service);
    }

    @Test
    void listRejectsUnknownGenre() throws Exception {
        ResultActions result = perform(get("/api/books").param("genre", "POETRY"));
        expectProblem(result, 400, "Validation failed");
        result.andExpect(jsonPath("$.errors.genre").value(containsString("FICTION")));
    }

    @Test
    void listRejectsNonBooleanAvailable() throws Exception {
        ResultActions result = perform(get("/api/books").param("available", "maybe"));
        expectProblem(result, 400, "Validation failed");
        result.andExpect(jsonPath("$.errors.available").exists());
    }

    @Test
    void listRejectsNonNumericSize() throws Exception {
        ResultActions result = perform(get("/api/books").param("size", "big"));
        expectProblem(result, 400, "Validation failed");
        result.andExpect(jsonPath("$.errors.size").exists());
    }

    // ---------- GET /api/books/{id} ----------

    @Test
    void getReturnsBook() throws Exception {
        when(service.get(ID)).thenReturn(GATSBY);

        perform(get("/api/books/{id}", ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(ID.toString()));
    }

    @Test
    void getUnknownReturns404() throws Exception {
        when(service.get(ID)).thenThrow(new BookNotFoundException(ID.toString()));

        expectProblem(perform(get("/api/books/{id}", ID)), 404, "Book not found");
    }

    @Test
    void getMalformedUuidReturns404() throws Exception {
        expectProblem(perform(get("/api/books/not-a-uuid")), 404, "Book not found");
        verifyNoInteractions(service);
    }

    @Test
    void unexpectedErrorReturns500WithoutInternals() throws Exception {
        when(service.get(ID)).thenThrow(new IllegalStateException("db password is hunter2"));

        ResultActions result = perform(get("/api/books/{id}", ID));
        expectProblem(result, 500, "Internal Server Error");
        result.andExpect(jsonPath("$.detail").value("An unexpected error occurred"))
                .andExpect(content().string(not(containsString("hunter2"))))
                .andExpect(content().string(not(containsString("IllegalState"))))
                .andExpect(content().string(not(containsString("com.example"))));
    }

    // ---------- POST /api/books ----------

    @Test
    void createReturns201WithLocation() throws Exception {
        when(service.create(any(BookInput.class))).thenReturn(GATSBY);

        perform(json(post("/api/books"), VALID_BODY))
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.LOCATION, "/api/books/" + ID))
                .andExpect(jsonPath("$.id").value(ID.toString()))
                .andExpect(jsonPath("$.available").value(true));
    }

    @Test
    void createTrimsInputBeforeCallingService() throws Exception {
        when(service.create(any(BookInput.class))).thenReturn(GATSBY);

        perform(json(post("/api/books"), """
                {"title":"  The Great Gatsby  ","author":" F. Scott Fitzgerald ","isbn":"9780743273565",
                 "publishedYear":1925,"genre":"FICTION"}
                """)).andExpect(status().isCreated());
        verify(service).create(new BookInput("The Great Gatsby", "F. Scott Fitzgerald", "9780743273565", 1925,
                Genre.FICTION));
    }

    @Test
    void createValidationFailureListsEveryField() throws Exception {
        ResultActions result = perform(json(post("/api/books"), """
                {"title":"   ","author":"","isbn":"9780743273566","publishedYear":1449}
                """));
        expectProblem(result, 400, "Validation failed");
        result.andExpect(jsonPath("$.errors.title").exists())
                .andExpect(jsonPath("$.errors.author").exists())
                .andExpect(jsonPath("$.errors.isbn").exists())
                .andExpect(jsonPath("$.errors.publishedYear").exists())
                .andExpect(jsonPath("$.errors.genre").exists());
        verifyNoInteractions(service);
    }

    @Test
    void createRejectsTooLongTitleAndAuthor() throws Exception {
        ResultActions result = perform(json(post("/api/books"), """
                {"title":"%s","author":"%s","isbn":"9780743273565","publishedYear":1925,"genre":"FICTION"}
                """.formatted("t".repeat(201), "a".repeat(121))));
        expectProblem(result, 400, "Validation failed");
        result.andExpect(jsonPath("$.errors.title").exists())
                .andExpect(jsonPath("$.errors.author").exists());
    }

    @Test
    void createAcceptsBoundaryLengths() throws Exception {
        when(service.create(any(BookInput.class))).thenReturn(GATSBY);

        perform(json(post("/api/books"), """
                {"title":"%s","author":"%s","isbn":"9780743273565","publishedYear":1450,"genre":"FICTION"}
                """.formatted("t".repeat(200), "a".repeat(120))))
                .andExpect(status().isCreated());
    }

    @Test
    void createRejectsIsbnWithLetters() throws Exception {
        ResultActions result = perform(json(post("/api/books"), VALID_BODY.replace("9780743273565", "97807432735X5")));
        expectProblem(result, 400, "Validation failed");
        result.andExpect(jsonPath("$.errors.isbn").exists());
    }

    @Test
    void createRejectsFutureYear() throws Exception {
        int nextYear = Year.now(ZoneOffset.UTC).getValue() + 1;
        ResultActions result = perform(json(post("/api/books"), VALID_BODY.replace("1925", String.valueOf(nextYear))));
        expectProblem(result, 400, "Validation failed");
        result.andExpect(jsonPath("$.errors.publishedYear").value("must not be later than the current year"));
    }

    @Test
    void createRejectsUnknownGenre() throws Exception {
        ResultActions result = perform(json(post("/api/books"), VALID_BODY.replace("FICTION", "POETRY")));
        expectProblem(result, 400, "Validation failed");
        result.andExpect(jsonPath("$.errors.genre").value(containsString("NON_FICTION")));
    }

    @Test
    void createRejectsUnknownField() throws Exception {
        ResultActions result = perform(json(post("/api/books"), VALID_BODY.replace("}", ",\"rating\":5}")));
        expectProblem(result, 400, "Validation failed");
        result.andExpect(jsonPath("$.errors.rating").value("unknown field"));
        verifyNoInteractions(service);
    }

    @Test
    void createRejectsWrongFieldType() throws Exception {
        ResultActions result = perform(json(post("/api/books"), VALID_BODY.replace("1925", "\"nineteen\"")));
        expectProblem(result, 400, "Validation failed");
        result.andExpect(jsonPath("$.errors.publishedYear").exists());
    }

    @Test
    void createRejectsMalformedJson() throws Exception {
        expectProblem(perform(json(post("/api/books"), "{\"title\":")), 400, "Validation failed");
        verifyNoInteractions(service);
    }

    @Test
    void createDuplicateIsbnReturns409() throws Exception {
        when(service.create(any(BookInput.class))).thenThrow(new DuplicateIsbnException("9780743273565"));

        expectProblem(perform(json(post("/api/books"), VALID_BODY)), 409, "Duplicate ISBN");
    }

    @Test
    void createConstraintViolationRaceReturns409() throws Exception {
        when(service.create(any(BookInput.class)))
                .thenThrow(new DataIntegrityViolationException("Unique index UK_BOOKS_ISBN violated"));

        ResultActions result = perform(json(post("/api/books"), VALID_BODY));
        expectProblem(result, 409, "Duplicate ISBN");
        result.andExpect(content().string(not(containsString("UK_BOOKS_ISBN"))));
    }

    // ---------- PUT /api/books/{id} ----------

    @Test
    void updateReturns200() throws Exception {
        when(service.update(eq(ID), any(BookInput.class))).thenReturn(GATSBY);

        perform(json(put("/api/books/{id}", ID), VALID_BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("The Great Gatsby"));
    }

    @Test
    void updateValidationFailureReturns400() throws Exception {
        ResultActions result = perform(json(put("/api/books/{id}", ID), VALID_BODY.replace("The Great Gatsby", "")));
        expectProblem(result, 400, "Validation failed");
        result.andExpect(jsonPath("$.errors.title").exists());
        verifyNoInteractions(service);
    }

    @Test
    void updateUnknownReturns404() throws Exception {
        when(service.update(eq(ID), any(BookInput.class))).thenThrow(new BookNotFoundException(ID.toString()));

        expectProblem(perform(json(put("/api/books/{id}", ID), VALID_BODY)), 404, "Book not found");
    }

    @Test
    void updateMalformedUuidReturns404() throws Exception {
        expectProblem(perform(json(put("/api/books/123"), VALID_BODY)), 404, "Book not found");
    }

    @Test
    void updateDuplicateIsbnReturns409() throws Exception {
        when(service.update(eq(ID), any(BookInput.class))).thenThrow(new DuplicateIsbnException("9780743273565"));

        expectProblem(perform(json(put("/api/books/{id}", ID), VALID_BODY)), 409, "Duplicate ISBN");
    }

    // ---------- PATCH /api/books/{id}/availability ----------

    @Test
    void patchAvailabilityReturns200() throws Exception {
        BookResponse loaned = new BookResponse(ID, GATSBY.title(), GATSBY.author(), GATSBY.isbn(),
                GATSBY.publishedYear(), GATSBY.genre(), false, CREATED);
        when(service.setAvailability(ID, false)).thenReturn(loaned);

        perform(json(patch("/api/books/{id}/availability", ID), "{\"available\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(false));
    }

    @Test
    void patchAvailabilityMissingFieldReturns400() throws Exception {
        ResultActions result = perform(json(patch("/api/books/{id}/availability", ID), "{}"));
        expectProblem(result, 400, "Validation failed");
        result.andExpect(jsonPath("$.errors.available").exists());
        verifyNoInteractions(service);
    }

    @Test
    void patchAvailabilityRejectsOtherFields() throws Exception {
        ResultActions result =
                perform(json(patch("/api/books/{id}/availability", ID), "{\"available\":true,\"title\":\"x\"}"));
        expectProblem(result, 400, "Validation failed");
        result.andExpect(jsonPath("$.errors.title").value("unknown field"));
        verifyNoInteractions(service);
    }

    @Test
    void patchAvailabilityUnknownReturns404() throws Exception {
        when(service.setAvailability(ID, true)).thenThrow(new BookNotFoundException(ID.toString()));

        expectProblem(perform(json(patch("/api/books/{id}/availability", ID), "{\"available\":true}")),
                404, "Book not found");
    }

    // ---------- DELETE /api/books/{id} ----------

    @Test
    void deleteReturns204() throws Exception {
        perform(delete("/api/books/{id}", ID)).andExpect(status().isNoContent());
        verify(service).delete(ID);
    }

    @Test
    void deleteUnknownReturns404() throws Exception {
        doThrow(new BookNotFoundException(ID.toString())).when(service).delete(ID);

        expectProblem(perform(delete("/api/books/{id}", ID)), 404, "Book not found");
    }

    @Test
    void deleteMalformedUuidReturns404() throws Exception {
        expectProblem(perform(delete("/api/books/zzz")), 404, "Book not found");
        verifyNoInteractions(service);
    }

    // ---------- CORS ----------

    @Test
    void corsPreflightAllowsConfiguredOrigin() throws Exception {
        perform(options("/api/books")
                .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:5173"));
    }

    @Test
    void corsPreflightRejectsOtherOrigin() throws Exception {
        perform(options("/api/books")
                .header(HttpHeaders.ORIGIN, "http://evil.example")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
                .andExpect(status().isForbidden());
    }
}
