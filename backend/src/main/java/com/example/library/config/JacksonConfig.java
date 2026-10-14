package com.example.library.config;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * The single source of JSON strictness (application.yml has no {@code spring.jackson} settings).
 *
 * <ul>
 *   <li>Unknown JSON properties are rejected (BE-AC9).</li>
 *   <li>No scalar coercion: {@code "available": 2}, {@code "publishedYear": "1999"} and
 *       {@code "publishedYear": 1999.7} are type errors (400), as the contract's types require.</li>
 *   <li>Dates are written as ISO-8601 strings.</li>
 * </ul>
 */
@Configuration(proxyBeanMethods = false)
public class JacksonConfig {

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer strictJsonCustomizer() {
        return builder -> builder
                .featuresToEnable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                .featuresToDisable(
                        MapperFeature.ALLOW_COERCION_OF_SCALARS,
                        DeserializationFeature.ACCEPT_FLOAT_AS_INT,
                        SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }
}
