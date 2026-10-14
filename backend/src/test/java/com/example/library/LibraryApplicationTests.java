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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/** Full application context: seeded H2 database, real service, repository and error handling. */
@SpringBootTest
@AutoConfigureMockMvc
class LibraryApplicationTests {

    private final MockMvc mvc;
    private final ObjectMapper objectMapper;

    @Autowired
    LibraryApplicationTests(MockMvc mvc, ObjectMapper objectMapper) {
        this.mvc = mvc;
        this.objectMapper = objectMapper;
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
        JsonNode node = objectMapper.readTree(created);
        String id = node.get("id").asText();

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

    @Test
    void malformedIdIsNotFound() throws Exception {
        mvc.perform(get("/api/books/not-a-uuid"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Book not found"));
    }
}
