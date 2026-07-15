# Z Report Analysis

## Overview

This document reverse engineers **only** the **Z Report** (fiscal daily closure) path of the
original Java SDK (`Ecr-1.7.739`). The Z Report is not a separate command class. It is produced by
the same command class and command ID as the X Report (`DailyClosureReport` /
`DAILY_FINANCIAL_REPORT` / `0x45`), but with a *different* `DailyClosureReportOptionEnum` value.
That option value is what turns a control read‑out (X) into a **fiscal closure** (Z).

Key result:

| Concept | Java enum | Stored char | Decimal | Hex | Reachable from shipped UI? |
|---|---|---:|---:|---:|---|
| Fiscal closure **WITHOUT** registers | `FISCAL_CLOSURE_WO_REGISTERS` | `'0'` | `48` | `0x30` | **No** (enum + payload logic only) |
| Fiscal closure **WITH** registers | `FISCAL_CLOSURE_WITH_REGISTERS` | `'1'` | `49` | `0x31` | **Yes** (report combo index `2`) |

The Java SDK therefore *defines* two Z (fiscal closure) variants but *wires only one* of them
(`FISCAL_CLOSURE_WITH_REGISTERS`) to the user interface. See
[Z Report Variants](#z-report-variants).

Packet framing, CRC, serial transport, articles, receipts, cash in/out, and the X Report are
intentionally **not** re‑analyzed here. The X Report is covered in `x-report-analysis.md`; this
document reuses the shared classes only to isolate the Z (closure) behavior.

---

## Java Classes

| Class | Package | Superclass / Interface | Role in Z Report |
|---|---|---|---|
| `DailyClosureReport` | `ecr.ecrcommunication.commands.reports` | `ecr.ecrcommunication.core.AEcrCommand` | Builds the `DAILY_FINANCIAL_REPORT` (`0x45`) payload from the option enum |
| `DailyClosureReportOptionEnum` | `ecr.ecrcommunication.enums` | `java.lang.Enum` | Encodes the closure option (`'0'`..`'4'`); the two `FISCAL_CLOSURE_*` values are the Z variants |
| `Ecr` | `ecr.ecrcommunication` | `java.lang.Object` | Facade `dailyClosure(option)` — sends the command and interprets the response |
| `ReportsPanel` | `ecr.ui.panels` | `ecr.ui.panels.CustomPanel` | Builds the report combo box (`getCmbReportType`) |
| `ReportsPanel$1` | `ecr.ui.panels` | `java.awt.event.ActionListener` | Execute‑button action listener |
| `ReportsPanel$1$1` | `ecr.ui.panels` | `java.lang.Runnable` | Worker thread that maps the selected combo index → enum → `Ecr.dailyClosure(...)` |
| `EcrResponseEnum` | `ecr.ecrcommunication.enums` | `java.lang.Enum` | Packet‑level result (`OK`, `NAK_RECEIVED`, timeouts, errors) checked before device data |
| `EcrResponseExecutionStatus` / `...Enum` | `ecr.ecrcommunication.enums` | — | Facade result object (`SUCCESS` / `ERROR`) returned to the UI |

Only `DailyClosureReport`, `DailyClosureReportOptionEnum`, `Ecr.dailyClosure`, and
`ReportsPanel$1$1` participate in producing a Z Report. Verified by a whole‑SDK reference scan:

```text
grep -rla "dailyClosure"           -> Ecr.class, ReportsPanel$1$1.class
grep -rla "DailyClosureReport"     -> DailyClosureReport.class, Ecr.class,
                                      DailyClosureReportOptionEnum.class, ReportsPanel$1$1.class
```

There is **no** separate `CloseDay`, `EndOfDay`, `ZReport`, or `FiscalClosure` command class in the
SDK. The Z Report is exclusively the `DailyClosureReport` command with a `FISCAL_CLOSURE_*` option.

---

## Enums

Class: `ecr.ecrcommunication.enums.DailyClosureReportOptionEnum`
Superclass: `java.lang.Enum`
Backing field: `private char value;`

| Enum constant | Stored char | Decimal | Hex | Meaning |
|---|---:|---:|---:|---|
| `FISCAL_CLOSURE_WO_REGISTERS` | `'0'` | `48` | `0x30` | **Z Report** — fiscal closure, no registers |
| `FISCAL_CLOSURE_WITH_REGISTERS` | `'1'` | `49` | `0x31` | **Z Report** — fiscal closure, with registers (default) |
| `REPORT_WO_FISCAL_CLOSURE_WO_REGISTERS` | `'2'` | `50` | `0x32` | X Report — control read‑out, no registers |
| `REPORT_WO_FISCAL_CLOSURE_WITH_REGISTERS` | `'3'` | `51` | `0x33` | X Report — control read‑out, with registers |
| `CASH_REGISTER_REPORT` | `'4'` | `52` | `0x34` | Operator/cash‑register read‑out |

The two rows relevant to this document are the **`FISCAL_CLOSURE_*`** constants — those are the
fiscal closure (Z) options. The other three are non‑closure and belong to the X‑report / other
report analysis.

### Bytecode evidence — `<clinit>` (constant construction)

```text
DailyClosureReportOptionEnum.<clinit>()
   4: ldc "FISCAL_CLOSURE_WO_REGISTERS"     ordinal 0   bipush 48   -> value '0'
  19: ldc "FISCAL_CLOSURE_WITH_REGISTERS"   ordinal 1   bipush 49   -> value '1'
  34: ldc "REPORT_WO_FISCAL_CLOSURE_WO_REGISTERS"   ordinal 2   bipush 50 -> '2'
  49: ldc "REPORT_WO_FISCAL_CLOSURE_WITH_REGISTERS" ordinal 3   bipush 51 -> '3'
  64: ldc "CASH_REGISTER_REPORT"            ordinal 4   bipush 52   -> value '4'
```

### Bytecode evidence — constructor stores the char

```text
DailyClosureReportOptionEnum.<init>(Ljava/lang/String;IC)V
   6: aload_0
   7: bipush 49            ; field pre-initialized to '1' before the ctor arg overwrites it
   9: putfield value:C
  12: aload_0
  13: iload_3              ; the real per-constant char ('0'..'4')
  14: putfield value:C
```

### Bytecode evidence — `getValue()` returns the raw char

```text
DailyClosureReportOptionEnum.getValue()C
   1: getfield value:C
   4: ireturn
```

This `char` is exactly what the printer payload uses (see below).

---

## Payloads

Class: `ecr.ecrcommunication.commands.reports.DailyClosureReport`
Superclass: `ecr.ecrcommunication.core.AEcrCommand`
Command: `CommandsEnum.DAILY_FINANCIAL_REPORT` = **`0x45` / decimal `69`**

### Constructors

```java
DailyClosureReport()                                   // option defaults to FISCAL_CLOSURE_WITH_REGISTERS
DailyClosureReport(DailyClosureReportOptionEnum option) // option supplied by caller
```

Bytecode:

```text
DailyClosureReport.<init>()V
   1: getstatic CommandsEnum.DAILY_FINANCIAL_REPORT
   4: invokespecial AEcrCommand.<init>(CommandsEnum)
   8: getstatic DailyClosureReportOptionEnum.FISCAL_CLOSURE_WITH_REGISTERS
  11: putfield option                         ; default = '1' (Z with registers)

DailyClosureReport.<init>(DailyClosureReportOptionEnum)V
   1: getstatic CommandsEnum.DAILY_FINANCIAL_REPORT
   4: invokespecial AEcrCommand.<init>(CommandsEnum)
   8: getstatic FISCAL_CLOSURE_WITH_REGISTERS
  11: putfield option                         ; default first...
  15: aload_1
  16: putfield option                         ; ...then overwritten with caller's option
```

The command ID (`bipush 69` / `0x45`) is established in `CommandsEnum.<clinit>` and is the same ID
used by the X Report — the *option byte* is the only differentiator.

### Payload builder — `toIntList()`

The device‑type branch inside `toIntList()` is what decides the on‑wire bytes.

#### Printer branch

```java
if (Constants.deviceType == DeviceTypeEnum.PRINTER) {
    result.add((int) option.getValue());   // single byte = the option char
    return result;
}
```

| Z variant | option char | Payload bytes (after command `0x45`) |
|---|---|---|
| `FISCAL_CLOSURE_WO_REGISTERS` | `'0'` | `0x30` |
| `FISCAL_CLOSURE_WITH_REGISTERS` | `'1'` | `0x31` |

#### Cash‑register branch

```java
if (Constants.deviceType == DeviceTypeEnum.CASH_REGISTER) {
    String closureType = "X";
    if (option == FISCAL_CLOSURE_WITH_REGISTERS ||
        option == FISCAL_CLOSURE_WO_REGISTERS) {
        closureType = "Z";
    }
    result.addAll(Utils.getIntListFromString(closureType + "\t"));
}
```

| Z variant | closureType chosen | Payload string | Payload bytes (after command `0x45`) |
|---|---|---|---|
| `FISCAL_CLOSURE_WO_REGISTERS` | `"Z"` | `"Z\t"` | `0x5A 0x09` |
| `FISCAL_CLOSURE_WITH_REGISTERS` | `"Z"` | `"Z\t"` | `0x5A 0x09` |

### Printer vs Cash Register — do they differ?

**Yes, they differ, and they differ in two ways:**

1. **Encoding shape.** Printer sends the raw ASCII option digit (`'0'`/`'1'`). Cash register sends a
   letter + TAB (`"Z\t"`).
2. **Register granularity is lost on cash register.** On a printer the *with/without registers*
   distinction survives as two different bytes (`0x31` vs `0x30`). On a cash register both Z options
   collapse to the **identical** payload `"Z\t"` (`0x5A 0x09`) — the `with/without registers`
   information is discarded by `toIntList()`.

Summary of Z payloads:

| Device | `FISCAL_CLOSURE_WITH_REGISTERS` | `FISCAL_CLOSURE_WO_REGISTERS` |
|---|---|---|
| `PRINTER` | `0x45` + `0x31` (`'1'`) | `0x45` + `0x30` (`'0'`) |
| `CASH_REGISTER` | `0x45` + `0x5A 0x09` (`"Z\t"`) | `0x45` + `0x5A 0x09` (`"Z\t"`) |

---

## How `toIntList()` decides X vs Z, and Printer vs Cash Register

`DailyClosureReport.toIntList()` makes two independent decisions:

1. **Device type** (outer branch) selects the *encoding*:
   - `PRINTER`  → emit `option.getValue()` (one digit byte).
   - `CASH_REGISTER` → emit `closureType + "\t"` (letter + TAB).
2. **X vs Z** is decided differently per device:
   - On **PRINTER** the firmware, not the SDK, distinguishes X from Z — the SDK just forwards the
     option digit. `'0'`/`'1'` = Z (closure), `'2'`/`'3'` = X (no closure), `'4'` = cash‑register
     report.
   - On **CASH_REGISTER** the SDK itself picks the letter: it starts with `"X"` and upgrades to
     `"Z"` **iff** the option is one of the two `FISCAL_CLOSURE_*` constants. Any other option
     (the `REPORT_WO_FISCAL_CLOSURE_*` X options, or `CASH_REGISTER_REPORT`) stays `"X"`.

### Bytecode evidence — `toIntList()`

```text
DailyClosureReport.toIntList()Ljava/util/List;
   0: new ArrayList ; astore_1 (result)
   8: getstatic Constants.deviceType
  11: getstatic DeviceTypeEnum.PRINTER
  14: if_acmpne -> 37              ; not a printer -> try cash register
  --- PRINTER branch ---
  17: aload_1
  19: getfield option
  22: invokevirtual DailyClosureReportOptionEnum.getValue()C
  25: invokestatic Integer.valueOf
  28: invokeinterface List.add
  34: goto -> 101                  ; return result

  --- CASH_REGISTER branch ---
  37: getstatic Constants.deviceType
  40: getstatic DeviceTypeEnum.CASH_REGISTER
  43: if_acmpne -> 101             ; neither -> return empty
  46: ldc "X" ; astore_2 (closureType)
  49: getfield option
  53: getstatic FISCAL_CLOSURE_WITH_REGISTERS
  56: if_acmpeq -> 69              ; option == WITH_REGISTERS -> Z
  59: getfield option
  63: getstatic FISCAL_CLOSURE_WO_REGISTERS
  66: if_acmpne -> 72              ; option != WO_REGISTERS -> keep "X"
  69: ldc "Z" ; astore_2           ; upgrade to Z
  72: aload_1
  73..89: new StringBuilder; append(closureType); append("\t"); toString()
  92: invokestatic Utils.getIntListFromString
  95: invokeinterface List.addAll
 101: aload_1 ; areturn
```

`ldc "\t"` at pc 84 confirms the trailing byte is a literal **TAB (`0x09`)**, so the cash‑register Z
payload is exactly `0x5A 0x09`.

---

## UI Workflow

UI class: `ecr.ui.panels.ReportsPanel`
Worker: `ecr.ui.panels.ReportsPanel$1$1` (a `Runnable` launched by the *Execute* button
`ReportsPanel$1.actionPerformed`).

The report combo box (`getCmbReportType`) holds 10 entries (indices `0`..`9`). The Cyrillic labels
are stored in the class file already mangled to `?` characters (lost at compile time — same as in
the X‑report analysis), so the *label text* is not recoverable from bytecode; the *index → action*
mapping is fully recoverable and is authoritative.

`ReportsPanel$1$1.run()` first branches on `Constants.deviceType`, then compares
`cmbReportType.getSelectedIndex()` against constants `0..9`.

### Full index → action map (both device types)

| Combo index | `DeviceTypeEnum.PRINTER` action | `DeviceTypeEnum.CASH_REGISTER` action |
|---:|---|---|
| `0` | `printDiagnosticInformation()` | `printDiagnosticInformation()` |
| `1` | `dailyClosure(REPORT_WO_FISCAL_CLOSURE_WO_REGISTERS)` — X | `dailyClosure(REPORT_WO_FISCAL_CLOSURE_WO_REGISTERS)` — X |
| **`2`** | **`dailyClosure(FISCAL_CLOSURE_WITH_REGISTERS)` — Z** | **`dailyClosure(FISCAL_CLOSURE_WITH_REGISTERS)` — Z** |
| `3` | `dailyClosure(REPORT_WO_FISCAL_CLOSURE_WITH_REGISTERS)` — extended X | `dailyClosure(REPORT_WO_FISCAL_CLOSURE_WITH_REGISTERS)` — extended X |
| `4` | `dailyClosure(CASH_REGISTER_REPORT)` | `printArticlesReport(false)` |
| `5` | `printTaxRatesReport(from,to)` | `printArticlesReport(true)` |
| `6` | `printShortPeriodicReport(from,to)` | `printShortPeriodicReport(from,to)` |
| `7` | `printShortNumberReport(a,b)` | `printShortNumberReport(a,b)` |
| `8` | `printDetailPeriodicReport(from,to)` | `printDetailPeriodicReport(from,to)` |
| `9` | `printDetailNumberReport(a,b)` | `printDetailNumberReport(a,b)` |

**The Z Report is combo index `2` in both device modes, and always uses
`FISCAL_CLOSURE_WITH_REGISTERS`.** No UI path passes `FISCAL_CLOSURE_WO_REGISTERS`.

### Bytecode evidence — printer branch, index 2 → Z

```text
ReportsPanel$1$1.run()
  63: getstatic Constants.deviceType
  66: getstatic DeviceTypeEnum.PRINTER
  69: if_acmpne -> 591                 ; else jump to cash-register block
 ...
 138: getSelectedIndex
 141: iconst_2
 142: if_icmpne -> 158                 ; index != 2 -> next case
 145: getstatic Constants.ECR
 148: getstatic DailyClosureReportOptionEnum.FISCAL_CLOSURE_WITH_REGISTERS
 151: invokevirtual Ecr.dailyClosure(...)      ; <-- Z REPORT (printer)
```

### Bytecode evidence — cash-register branch, index 2 → Z

```text
 591: getstatic Constants.deviceType
 594: getstatic DeviceTypeEnum.CASH_REGISTER
 597: if_acmpne -> 1089
 ...
 666: getSelectedIndex
 669: iconst_2
 670: if_icmpne -> 686
 673: getstatic Constants.ECR
 676: getstatic DailyClosureReportOptionEnum.FISCAL_CLOSURE_WITH_REGISTERS
 679: invokevirtual Ecr.dailyClosure(...)      ; <-- Z REPORT (cash register)
```

---

## Z Report Variants

**Question: does Java have one or multiple Z Report variants?**

The SDK *defines* two Z (fiscal closure) variants but *exposes* only one through the UI.

| # | Java enum | Char / bytes (printer) | Bytes (cash reg) | UI menu | Purpose | Reachable? |
|---|---|---|---|---|---|---|
| 1 | `FISCAL_CLOSURE_WITH_REGISTERS` | `'1'` / `0x31` | `0x5A 0x09` | Report combo **index 2** (both modes) | Daily fiscal closure incl. registers | **Yes** |
| 2 | `FISCAL_CLOSURE_WO_REGISTERS` | `'0'` / `0x30` | `0x5A 0x09` | *(none)* | Daily fiscal closure without registers | **No** — enum + `toIntList` only |

Supporting (non‑Z) closure‑family option for completeness — *not* a fiscal closure:

| Java enum | Purpose | UI (printer) |
|---|---|---|
| `CASH_REGISTER_REPORT` (`'4'`/`0x34`) | Operator / cash‑register read‑out (no fiscal closure) | Report combo index 4 (printer only) |

### Proof that `FISCAL_CLOSURE_WO_REGISTERS` is unreachable from the UI

- Whole‑SDK scan: the only class that invokes `Ecr.dailyClosure` is `ReportsPanel$1$1`.
- In `ReportsPanel$1$1.run()` the four `dailyClosure(...)` call sites reference (via `getstatic`)
  exactly these constants: `REPORT_WO_FISCAL_CLOSURE_WO_REGISTERS` (index 1),
  `FISCAL_CLOSURE_WITH_REGISTERS` (index 2), `REPORT_WO_FISCAL_CLOSURE_WITH_REGISTERS` (index 3),
  `CASH_REGISTER_REPORT` (index 4, printer only). `FISCAL_CLOSURE_WO_REGISTERS` is **never** loaded
  as an argument.
- The only *reads* of `FISCAL_CLOSURE_WO_REGISTERS` anywhere are (a) the enum's own
  `<clinit>`/`getByValue`, and (b) the `if_acmpne` guard in `DailyClosureReport.toIntList()` that
  upgrades the cash‑register `closureType` to `"Z"`.

Conclusion: **one Z Report is user‑triggerable** (`FISCAL_CLOSURE_WITH_REGISTERS`, combo index 2),
while a **second Z variant exists in the type system and payload logic**
(`FISCAL_CLOSURE_WO_REGISTERS`) that can only be reached by a programmatic caller constructing
`DailyClosureReport(FISCAL_CLOSURE_WO_REGISTERS)` directly.

---

## Java Pseudocode

```java
// ---- enum ----
enum DailyClosureReportOptionEnum {
    FISCAL_CLOSURE_WO_REGISTERS('0'),    // Z, no registers   (unused by UI)
    FISCAL_CLOSURE_WITH_REGISTERS('1'),  // Z, with registers (UI default)
    REPORT_WO_FISCAL_CLOSURE_WO_REGISTERS('2'),   // X
    REPORT_WO_FISCAL_CLOSURE_WITH_REGISTERS('3'), // extended X
    CASH_REGISTER_REPORT('4');
    private final char value;
    char getValue() { return value; }
}

// ---- command ----
class DailyClosureReport extends AEcrCommand {
    private DailyClosureReportOptionEnum option = FISCAL_CLOSURE_WITH_REGISTERS;

    DailyClosureReport()                              { super(CommandsEnum.DAILY_FINANCIAL_REPORT); } // 0x45
    DailyClosureReport(DailyClosureReportOptionEnum o){ super(CommandsEnum.DAILY_FINANCIAL_REPORT); this.option = o; }

    List<Integer> toIntList() {
        List<Integer> result = new ArrayList<>();
        if (Constants.deviceType == DeviceTypeEnum.PRINTER) {
            result.add((int) option.getValue());          // Z: '0' (0x30) or '1' (0x31)
            return result;
        }
        if (Constants.deviceType == DeviceTypeEnum.CASH_REGISTER) {
            String closureType = "X";
            if (option == FISCAL_CLOSURE_WITH_REGISTERS ||
                option == FISCAL_CLOSURE_WO_REGISTERS) {
                closureType = "Z";                          // Z collapses to "Z\t" (0x5A 0x09)
            }
            result.addAll(Utils.getIntListFromString(closureType + "\t"));
        }
        return result;
    }
}

// ---- UI worker (Z path only) ----
void run() {                 // ReportsPanel$1$1
    if (Constants.deviceType == DeviceTypeEnum.PRINTER) {
        switch (cmbReportType.getSelectedIndex()) {
            case 2: result = Constants.ECR.dailyClosure(FISCAL_CLOSURE_WITH_REGISTERS); break; // Z
            // ... other indices (X, reports) ...
        }
    } else if (Constants.deviceType == DeviceTypeEnum.CASH_REGISTER) {
        switch (cmbReportType.getSelectedIndex()) {
            case 2: result = Constants.ECR.dailyClosure(FISCAL_CLOSURE_WITH_REGISTERS); break; // Z
            // ...
        }
    }
    if (result.getEcrResponseExecutionStatusEnum() != SUCCESS) showError();
    Constants.MAIN_FRAME.enableFields();
}
```

---

## Response Handling

Facade: `Ecr.dailyClosure(DailyClosureReportOptionEnum)` →
`EcrResponseExecutionStatus`.

Flow:

1. `EcrResponse response = ecrSerialPort.sendReceive(new DailyClosureReport(option));`
2. Gate on the **packet‑level** result: `if (response.getResult() == EcrResponseEnum.OK)`.
   If it is not `OK`, the status stays `ERROR` (the object was pre‑initialized to `ERROR`).
3. Then the behavior **splits by device type**:

### Printer

- On `OK`: status is set to `SUCCESS` **unconditionally**.
- If `response.getData()` is non‑null and non‑empty, the data is converted with
  `Utils.getStringFromIntList(...)` and stored via `setResponseObject(...)`.
- The response data is **captured but never validated** — there is **no** `'P'` or `'F'` check.
- Net: for a printer, a successful Z Report requires only that the transport returned `OK`.

### Cash Register

- On `OK`, the facade **requires the first response data byte to equal `80`** (`bipush 80` =
  `0x50` = ASCII **`'P'`**). Only then is the status set to `SUCCESS` and the data stored.
- If the first byte is not `'P'`, the status remains `ERROR`.
- `'F'` (or any other letter) is **not** matched — anything other than `'P'` is treated as failure.

### Bytecode evidence — `Ecr.dailyClosure(...)`

```text
Ecr.dailyClosure(DailyClosureReportOptionEnum)
   0: new EcrResponseExecutionStatus(ERROR) ; astore_2           ; default = ERROR
  15: new DailyClosureReport(option)
  23: invokevirtual EcrSerialPort.sendReceive(...)  ; astore_3   ; response
  27: response.getResult()
  31: getstatic EcrResponseEnum.OK
  34: if_acmpne -> 144                              ; not OK -> return ERROR

  37: getstatic Constants.deviceType
  40: getstatic DeviceTypeEnum.CASH_REGISTER
  43: if_acmpne -> 107                              ; not cash register -> printer branch

  --- CASH_REGISTER branch ---
  46: response.getData(); ifnull -> 144
  53: response.getData().size(); ifle -> 144
  65: response.getData().get(0) -> Integer.intValue()
  81: bipush 80                                     ; 'P' (0x50)
  83: if_icmpne -> 144                              ; first byte != 'P' -> stay ERROR
  86: status.setEcrResponseExecutionStatusEnum(SUCCESS)
  93: status.setResponseObject(Utils.getStringFromIntList(data))
 104: goto -> 144

  --- PRINTER branch ---
 107: response.getData(); ifnull -> 137
 114: response.getData().size(); ifle -> 137
 126: status.setResponseObject(Utils.getStringFromIntList(data))
 137: status.setEcrResponseExecutionStatusEnum(SUCCESS)   ; unconditional on OK
 144: (return status)
```

### Answers

| Question | Answer (with evidence) |
|---|---|
| Does Java expect `P` after a successful Z Report? | **Cash register: yes** — `bipush 80` / `if_icmpne` requires first data byte `'P'`. **Printer: no** — no such check. |
| Does Java expect `F`? | **No** — `'F'` (`0x46`) is never compared in `dailyClosure`. On cash register, non‑`'P'` (incl. `'F'`) simply fails; on printer nothing is compared. |
| Does Java expect any other response? | It first requires the transport‑level `EcrResponseEnum.OK`. Beyond that, only cash register inspects a byte (must be `'P'`). |
| Does Java expect response *data*? | **Cash register: yes**, it needs at least one byte and it must be `'P'`. **Printer: optional** — data is stored if present but not required. |
| Does Java ignore response data? | **Printer: effectively yes** for success determination (data is saved to `responseObject` but not checked). **Cash register: no** — the first byte gates success. |
| Does Java only wait for `OK`? | **Printer: yes** (`OK` alone ⇒ `SUCCESS`). **Cash register: no** (`OK` **and** first byte `'P'`). |

---

## Conclusion

- The **Z Report is fiscal closure** produced by `DailyClosureReport`
  (`CommandsEnum.DAILY_FINANCIAL_REPORT`, **command ID `0x45` / `69`**) — the *same* command class
  and ID as the X Report. The **`DailyClosureReportOptionEnum` value** is the sole differentiator.
- The Z (fiscal closure) options are the two `FISCAL_CLOSURE_*` constants:
  `FISCAL_CLOSURE_WO_REGISTERS` (`'0'`/`0x30`) and `FISCAL_CLOSURE_WITH_REGISTERS` (`'1'`/`0x31`).
- **Payloads:**
  - Printer — one digit byte: `0x31` (with registers) or `0x30` (without registers).
  - Cash register — `"Z\t"` = `0x5A 0x09` for **either** Z option (register granularity is dropped).
- **UI:** report combo **index 2** triggers the Z Report in both printer and cash‑register modes,
  always with `FISCAL_CLOSURE_WITH_REGISTERS`. Proven by `if_icmpne`/`getstatic` at pc 141/148
  (printer) and pc 669/676 (cash register).
- **Variants:** the SDK defines **two** Z variants but wires **one** (`FISCAL_CLOSURE_WITH_REGISTERS`)
  to the UI; `FISCAL_CLOSURE_WO_REGISTERS` is unreachable except by a direct programmatic caller.
- **Response:** the facade always requires packet‑level `EcrResponseEnum.OK`. On a **printer**,
  `OK` alone is success (response data captured but not validated — no `'P'`/`'F'` check). On a
  **cash register**, success additionally requires the first response data byte to be **`'P'`
  (`0x50`/`80`)**; `'F'` is never explicitly handled.

---

## UNKNOWN Section

| Question | Status |
|---|---|
| Exact printed Cyrillic label of report combo index 2 ("Z Report") | **UNKNOWN.** The combo strings are stored in the class file already mangled to `?` characters (compile‑time encoding loss). The index→enum mapping is proven; the human‑readable label text is not recoverable from bytecode. |
| Firmware interpretation of printer payload `'0'` vs `'1'` (register granularity) | **UNKNOWN.** Bytecode proves the two distinct bytes are sent; how the firmware renders "with/without registers" is device‑side. |
| Why cash register collapses both Z options to `"Z\t"` | **UNKNOWN (by design in `toIntList`).** The collapse is proven in bytecode; the firmware rationale is not in the SDK. |
| Meaning of the cash‑register `'P'` acknowledgment byte, and whether a `'F'` is emitted by the device on failure | **UNKNOWN at the SDK level.** Java only tests for `'P'`; any non‑`'P'` (including a possible `'F'`) is treated as failure without being named. Device semantics are firmware‑side. |
| Whether `FISCAL_CLOSURE_WO_REGISTERS` was ever reachable in an earlier/other UI build | **UNKNOWN.** In this build (`Ecr-1.7.739`) it is unreferenced as a `dailyClosure` argument. |
| Structure/format of the printer's Z response data (stored via `setResponseObject`) | **UNKNOWN.** It is converted to a string and stored but never parsed in `dailyClosure`; format is not asserted by the SDK. |
