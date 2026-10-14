package com.example.library.book;

import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.data.jpa.domain.Specification;

/** Dynamic search filters for {@link Book}. Every argument is optional; the filters combine with AND. */
public final class BookSpecifications {

    private static final char ESCAPE = '\\';

    private BookSpecifications() {
    }

    public static Specification<Book> matching(String q, Genre genre, Boolean available) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                String pattern = "%" + escapeLike(q.strip().toLowerCase(Locale.ROOT)) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.<String>get("title")), pattern, ESCAPE),
                        cb.like(cb.lower(root.<String>get("author")), pattern, ESCAPE)));
            }
            if (genre != null) {
                predicates.add(cb.equal(root.<Genre>get("genre"), genre));
            }
            if (available != null) {
                predicates.add(cb.equal(root.<Boolean>get("available"), available));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    static String escapeLike(String value) {
        StringBuilder sb = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c == ESCAPE || c == '%' || c == '_') {
                sb.append(ESCAPE);
            }
            sb.append(c);
        }
        return sb.toString();
    }
}
