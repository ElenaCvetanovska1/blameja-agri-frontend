# X / Z Report — hardware-verified payload for command 0x45

Why both X-report endpoints (`/api/fiscal/reports/x`, `/api/fiscal/reports/x/extended`) print the
**same** `ПРОШИРЕН` report — and what the real Accent device actually accepts. Conclusions below are
confirmed by **live hardware probing** (via a temporary `dev/report-probe` endpoint, since removed),
not only by decompiling `Ecr-1.7.739.jar`.

**Decision:** on this device command `0x45` yields only the extended X (`ПРОШИРЕН`); that is accepted
as the final behavior — both X endpoints print `ПРОШИРЕН`, and there is no short-report support.

## One-sentence answer

For `DAILY_FINANCIAL_REPORT` (`0x45`) this device accepts **only** the cash-register letter+TAB form
— `"X\t"` (`0x58 0x09`) → the extended control report (`ПРОШИРЕН КОНТРОЛЕН ИЗВЕШТАЈ`), and `"Z\t"`
(`0x5A 0x09`) → fiscal daily closure; there is **no** separate short `КОНТРОЛЕН ИЗВЕШТАЈ` reachable
from the PC over this command.

## Hardware probe results (command 0x45)

| Payload sent | request bytes after `45` | Device result |
|---|---|---|
| `"X\t"` | `58 09` | **prints ПРОШИРЕН** (read times out >3 s, but the print succeeds) |
| `"x\t"` (lowercase) | `78 09` | `F  -1004  Bad input` — rejected |
| `"2\t"` | `32 09` | `F  -1004  Bad input` — rejected |
| `"3\t"` | `33 09` | `F  -1004  Bad input` — rejected |
| `"X\t\t"` | `58 09 09` | `F  -12001` — rejected (extra parameter) |
| `"X\t0\t"` | `58 09 30 09` | `F  -12001` — rejected |
| `"X\t1\t"` | `58 09 31 09` | `F  -12001` — rejected |

Interpretation: the report-type field must be a single recognized **letter**. `-1004 "Bad input"`
means the first field char is not accepted (digits and lowercase all fail). `-12001` means the first
field `X` is valid but a second parameter is not allowed. So the grammar is exactly `X<TAB>` or
`Z<TAB>` and nothing else.

## Why both X endpoints print the same report

This matches the Java SDK precisely. `DailyClosureReport.toIntList()` CASH_REGISTER branch collapses
**every** control-report option to `"X\t"`:

```
46: ldc "X"
49..66: if option == FISCAL_CLOSURE_WITH_REGISTERS || option == FISCAL_CLOSURE_WO_REGISTERS -> "Z"
72..92: getIntListFromString(closureType + "\t")
```

And in `ReportsPanel$1$1.run()` the CASH_REGISTER branch maps **both** report indices 1 and 3 to
`Ecr.dailyClosure(...)`, which both serialize to `"X\t"`. So the original PC software on this device
*also* produced the same (extended) X report for both menu items. The short `КОНТРОЛЕН ИЗВЕШТАЈ` is a
device-keypad / firmware function, not a distinct `0x45` payload.

## Note on the earlier "printer vs cash register" question

The hardware-verified diagnostic used the *printer* payload `"1"` (0x31) and the open-receipt used
`"1,0000,1"`, which first suggested PRINTER mode. But the **report command's** measured behavior is
unambiguously the **cash-register** grammar (`"X\t"`/`"Z\t"`; the printer digit `'2'`/`'3'` is
rejected as "Bad input"). The device firmware accepts a mix of formats across commands; for `0x45`
the letter+TAB form is the only valid one. When in doubt, the probe endpoint is the oracle.

## Fix applied

`FiscalBridgeService.BuildDailyReportPayload(option)` returns `"Z\t"` for the two `FISCAL_CLOSURE_*`
options and `"X\t"` for everything else — the only forms the device accepts. Both X endpoints
therefore (correctly) drive the single available extended X report; the Z endpoint drives closure.

## Open items

- **Read timeout.** A full report takes >3 s to print, so the current `OverallReadTimeoutMs=3000`
  makes even a successful report return `TIMEOUT_READING`. Raise it (~15000 ms) for report commands
  so the endpoint reports success instead of a false timeout. The print itself already succeeds.
- **Short `КОНТРОЛЕН` from PC.** Not available via `0x45` and accepted as out of scope. If ever
  required over serial it would have to be a different command id (an FM/periodic/operator report);
  that has not been identified and would need its own probing.
