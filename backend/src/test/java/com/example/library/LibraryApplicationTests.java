package com.example.library;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.library.book.BookRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Full application context: seeded H2 database, real service, repository and error handling.
 *
 * <p>The context (and its database) is shared by every test. Any book a test creates is tracked in
 * {@link #createdIds} and removed in {@link #deleteCreatedBooks()}, so a failing assertion never
 * leaves extra rows behind for tests that count the seed data (R2-BE-02).
 */
@SpringBootTest
@AutoConfigureMockMvc
class LibraryApplicationTests {

    private final MockMvc mvc;
    private final ObjectMapper objectMapper;
    private final BookRepository repository;
    private final List<UUID> createdIds = new ArrayList<>();

    @Autowired
    LibraryApplicationTests(MockMvc mvc, ObjectMapper objectMapper, BookRepository repository) {
        this.mvc = mvc;
        this.objectMapper = objectMapper;
        this.repository = repository;
    }

    /** Runs even when the test failed; deleting an id that is already gone is a no-op. */
    @AfterEach
    void deleteCreatedBooks() {
        repository.deleteAllById(createdIds);
        createdIds.clear();
    }

    private String track(JsonNode created) {
        String id = created.get("id").asText();
        createdIds.add(UUID.fromString(id));
        return id;
    }

    @Test
    void contextLoads() {
        // The constructor injection above proves the context started.
    }

    @Test
    void healthIsUp() throws Exception {
        mvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void seedDataIsSortedByTitleIgnoringCase() throws Exception {
        mvc.perform(get("/api/books").param("genre", "CHILDREN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].title").value("Charlotte's Web"));
        mvc.perform(get("/api/books").param("genre", "FICTION").param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].title").value("1984"))
                .andExpect(jsonPath("$.items[1].title").value("The Great Gatsby"))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.totalItems").value(3))
                .andExpect(jsonPath("$.totalPages").value(2));
    }

    @Test
    void fullBookLifecycle() throws Exception {
        String body = """
                {"title":"Refactoring","author":"Martin Fowler","isbn":"9780134757599","publishedYear":2018,"genre":"TECHNOLOGY"}
                """;
        String created = mvc.perform(post("/api/books").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", containsString("/api/books/")))
                .andExpect(jsonPath("$.available").value(true))
                .andReturn().getResponse().getContentAsString();
        String id = track(objectMapper.readTree(created));

        mvc.perform(post("/api/books").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Duplicate ISBN"));

        mvc.perform(put("/api/books/{id}", id).contentType(MediaType.APPLICATION_JSON)
                        .content(body.replace("9780134757599", "9780743273565")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Duplicate ISBN"));

        mvc.perform(put("/api/books/{id}", id).contentType(MediaType.APPLICATION_JSON)
                        .content(body.replace("Refactoring", "Refactoring Second Edition").replace("2018", "2019")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Refactoring Second Edition"))
                .andExpect(jsonPath("$.publishedYear").value(2019));

        mvc.perform(patch("/api/books/{id}/availability", id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"available\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(false))
                .andExpect(jsonPath("$.title").value("Refactoring Second Edition"));

        mvc.perform(get("/api/books").param("q", "SECOND edition").param("available", "false"))
                .andExpect(jsonPath("$.totalItems").value(1));

        mvc.perform(delete("/api/books/{id}", id)).andExpect(status().isNoContent());
        mvc.perform(get("/api/books/{id}", id))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Book not found"));
    }

    /** R-BE-01: the createdAt returned by POST is the value every later read returns. */
    @Test
    void createdAtFromPostEqualsCreatedAtFromGet() throws Exception {
        String body = """
                {"title":"Dune","author":"Frank Herbert","isbn":"9780441013593","publishedYear":1965,"genre":"FICTION"}
                """;
        JsonNode created = objectMapper.readTree(mvc.perform(post("/api/books")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString());
        String id = track(created);
        String createdAt = created.get("createdAt").asText();

        mvc.perform(get("/api/books/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.createdAt").value(createdAt));
        mvc.perform(get("/api/books").param("q", "Frank Herbert"))
                .andExpect(jsonPath("$.items[0].createdAt").value(createdAt));

        mvc.perform(delete("/api/books/{id}", id)).andExpect(status().isNoContent());
    }

    /** R-BE-02: the application's own ObjectMapper (not just the test slice) refuses scalar coercion. */
    @Test
    void availabilityRejectsNumberInFullContext() throws Exception {
        String id = objectMapper.readTree(mvc.perform(get("/api/books").param("size", "1"))
                .andReturn().getResponse().getContentAsString()).get("items").get(0).get("id").asText();

        mvc.perform(patch("/api/books/{id}/availability", id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"available\":2}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.available").exists());
    }

    /** R2-BE-01: the application's own ObjectMapper refuses numbers and booleans for string fields. */
    @Test
    void stringFieldsRejectNonStringScalarsInFullContext() throws Exception {
        String body = """
                {"title":"Refactoring","author":"Martin Fowler","isbn":9780134757599,"publishedYear":2018,"genre":"TECHNOLOGY"}
                """;
        mvc.perform(post("/api/books").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.isbn").value("has an invalid type or format"));
        mvc.perform(post("/api/books").contentType(MediaType.APPLICATION_JSON)
                        .content(body.replace("9780134757599", "\"9780134757599\"").replace("\"Martin Fowler\"", "true")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.author").value("has an invalid type or format"));
    }

    @Test
    void malformedIdIsNotFound() throws Exception {
        mvc.perform(get("/api/books/not-a-uuid"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Book not found"));
    }
}
