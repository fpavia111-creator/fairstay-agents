# evergreen-core

Shared helpers for the Evergreen nursing-home agents (sold as **Fairstay** on [fair-agents.com](https://fair-agents.com/fairstay.html)). It re-exports [`remedy-core`](../remedy-core) (masking of resident and staff identifiers, policy and approvals, audit log, MCP server, evals) and adds what skilled nursing back offices need:

- **Agent builder:** `snfAgent` with `EVERGREEN_LIMITS` and the shared argument shapes `fileArg`, `DATE_ARG`, `MONTH_ARG`.
- **Census:** `CENSUS_FIELDS`, `censusDays`, `rowDays`, `dayIndex`, `bedStatus`, and the payer helpers `PAYER_TYPES` and `payerType`.
- **Column names** for common census and billing exports: `RESIDENT_ID`, `RESIDENT_NAME`, `FACILITY`, `PAYER`, `PAYER_TYPE`, `LEVEL`, `DATE_FROM`, `DATE_TO`, `AMOUNT`.
- **Dates and money:** `monthBounds`, `monthOf`, `dateRange`, `dayRuns`, `rateFor`, `ageDays`, `agingBucket`, `total`, `countBy`.
- **Demos:** `runDemo` for the `demo` command every agent has.

Medicare and Medicaid rules are settings the facility confirms, not advice. Masking keeps identifiers away from the model; it is not a HIPAA compliance determination.

MIT. Node 20 or newer.
