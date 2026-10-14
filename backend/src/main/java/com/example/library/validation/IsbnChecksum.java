package com.example.library.validation;

/** Pure ISBN-13 checksum logic (no framework dependencies). */
public final class IsbnChecksum {

    public static final int LENGTH = 13;

    private IsbnChecksum() {
    }

    /**
     * Returns {@code true} when {@code value} is exactly 13 ASCII digits and its last digit is the
     * correct ISBN-13 check digit (weights 1,3,1,3,... over the first 12 digits).
     */
    public static boolean isValid(String value) {
        if (value == null || value.length() != LENGTH) {
            return false;
        }
        int sum = 0;
        for (int i = 0; i < LENGTH; i++) {
            char c = value.charAt(i);
            if (c < '0' || c > '9') {
                return false;
            }
            if (i < LENGTH - 1) {
                int digit = c - '0';
                sum += (i % 2 == 0) ? digit : digit * 3;
            }
        }
        int expected = (10 - (sum % 10)) % 10;
        return expected == value.charAt(LENGTH - 1) - '0';
    }
}
