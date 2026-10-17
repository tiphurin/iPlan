# @iplan/core

Pure domain logic with no I/O, shared by the API and the web app. Every function is unit-tested (`yarn workspace @iplan/core test`).

| Module     | What it does                                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------------- |
| `money`    | Money as bigint minor units per currency; exact parsing, formatting, FX conversion with a stored rate                 |
| `split`    | Equal / exact / percentage splits that always add up, balances, who-pays-whom settlement                              |
| `budget`   | Monthly recurring lines (income, deductions, fixed costs) with per-month overrides, monthly summary, category budgets |
| `schedule` | Live trip schedule: current item and progress, next item countdown, day progress, late/early vs plan, sleep length    |
| `time`     | IANA time-zone helpers: offsets, local dates, `datetime-local` input conversion that handles DST                      |
