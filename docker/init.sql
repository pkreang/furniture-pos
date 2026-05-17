-- Runs only on first initialization of an empty Postgres data directory.
-- Provisions the separate database used by the API integration tests.
CREATE DATABASE furniture_pos_test;
