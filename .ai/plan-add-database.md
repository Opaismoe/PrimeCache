# Add Database

## Purpose

This project needs a database to store the run history and the configuration.
We're using SQLite for now, but we need to add a PostgreSQL database.

## What we will use
We will use a PostgreSQL database.
In production, we will be using a postgres database hosted on coolify.
We will use drizzle for the ORM.
We will use zod for the validation.

## Database Schema

```sql
CREATE TABLE runs (
  id SERIAL PRIMARY KEY,
  group_name VARCHAR(255) NOT NULL,
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  status VARCHAR(255) NOT NULL,
  total_urls INT,
  success_count INT,
  failure_count INT
)

CREATE TABLE visits (
  id SERIAL PRIMARY KEY,
  run_id INT NOT NULL,
  url VARCHAR(255) NOT NULL,
  status_code INT,
  final_url VARCHAR(255),
  ttfb_ms INT,
  load_time_ms INT,
  consent_found BOOLEAN,
  consent_strategy VARCHAR(255),
  error TEXT,
  visited_at TIMESTAMP NOT NULL
)
```
### Tech Stack
We will use drizzle for the ORM.