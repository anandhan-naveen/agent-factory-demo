package com.example.library;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

// Spring instantiates the @SpringBootApplication class as a configuration bean, so it cannot be a utility class.
@SuppressWarnings("PMD.UseUtilityClass")
@SpringBootApplication
public class LibraryApplication {

    public static void main(String[] args) {
        SpringApplication.run(LibraryApplication.class, args);
    }
}
