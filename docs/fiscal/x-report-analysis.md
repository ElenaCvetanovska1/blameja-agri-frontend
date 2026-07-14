# X Report Analysis

## Overview

This document answers how the original Java SDK differentiates the two X Report variants observed on real hardware:

| Printed title observed on device | Java meaning | Command | Printer payload |
|---|---|---:|---|
| `КОНТРОЛЕН ИЗВЕШТАЈ` | report without fiscal closure, without registers | `DAILY_FINANCIAL_REPORT` / `0x45` | ASCII `2` / hex `32` |
| `ПРОШИРЕН КОНТРОЛЕН ИЗВЕШТАЈ` | report without fiscal closure, with registers | `DAILY_FINANCIAL_REPORT` / `0x45` | ASCII `3` / hex `33` |

Both variants use the same Java command class and the same command ID. The difference is the `DailyClosureReportOptionEnum` value passed to the constructor, which changes the payload byte for fiscal printer devices.

General serial communication, packet framing, CRC, articles, receipts, cash operations, and Z Report behavior are intentionally not analyzed here.

## Java Classes

| Class | Package | Role | X Report candidate? |
|---|---|---|---|
| `DailyClosureReport` | `ecr.ecrcommunication.commands.reports` | Builds command `DAILY_FINANCIAL_REPORT` payload from `DailyClosureReportOptionEnum` | Yes |
| `DailyClosureReportOptionEnum` | `ecr.ecrcommunication.enums` | Encodes report option values `0`..`4` | Yes |
| `Ecr` | `ecr.ecrcommunication` | Facade method `dailyClosure(option)` sends `DailyClosureReport` | Yes |
| `ReportsPanel` | `ecr.ui.panels` | Builds report type combo box | Yes, UI source |
| `ReportsPanel$1$1` | `ecr.ui.panels` | Execute-button worker; maps selected index to enum value | Yes, UI caller |
| `DiagnosticInformationReport` | `ecr.ecrcommunication.commands.reports` | Report menu candidate, selected index `0`; not X Report | No |
| `ReportTaxRates` | `ecr.ecrcommunication.commands.reports` | Report menu candidate; not X Report | No |
| `ShortPeriodReport` | `ecr.ecrcommunication.commands.reports` | Fiscal memory report candidate; not X Report | No |
| `ShortNumberReport` | `ecr.ecrcommunication.commands.reports` | Fiscal memory report candidate; not X Report | No |
| `DetailPeriodReport` | `ecr.ecrcommunication.commands.reports` | Fiscal memory report candidate; not X Report | No |
| `DetailNumberReport` | `ecr.ecrcommunication.commands.reports` | Fiscal memory report candidate; not X Report | No |

Only `DailyClosureReport` and `DailyClosureReportOptionEnum` are proven to produce the two X Report variants.

## Enums

Class: `ecr.ecrcommunication.enums.DailyClosureReportOptionEnum`

The enum stores one `char value` per report option. `DailyClosureReport.toIntList()` uses this char directly for fiscal printer devices.

| Enum value | Stored char | Decimal | Hex | Notes |
|---|---:|---:|---:|---|
| `FISCAL_CLOSURE_WO_REGISTERS` | `'0'` | `48` | `0x30` | Listed for completeness only |
| `FISCAL_CLOSURE_WITH_REGISTERS` | `'1'` | `49` | `0x31` | Default constructor value; listed for completeness only |
| `REPORT_WO_FISCAL_CLOSURE_WO_REGISTERS` | `'2'` | `50` | `0x32` | Normal X Report / `КОНТРОЛЕН ИЗВЕШТАЈ` |
| `REPORT_WO_FISCAL_CLOSURE_WITH_REGISTERS` | `'3'` | `51` | `0x33` | Extended X Report / `ПРОШИРЕН КОНТРОЛЕН ИЗВЕШТАЈ` |
| `CASH_REGISTER_REPORT` | `'4'` | `52` | `0x34` | Separate report option |

Bytecode evidence:

```text
DailyClosureReportOptionEnum.<clinit>()
  FISCAL_CLOSURE_WO_REGISTERS             char 48
  FISCAL_CLOSURE_WITH_REGISTERS           char 49
  REPORT_WO_FISCAL_CLOSURE_WO_REGISTERS   char 50
  REPORT_WO_FISCAL_CLOSURE_WITH_REGISTERS char 51
  CASH_REGISTER_REPORT                    char 52
```

`getByValue(char)` maps these payload chars back to enum values:

```text
METHOD getByValue(C)
  0: iload_0
  1: tableswitch { // 48 to 52
          48: FISCAL_CLOSURE_WO_REGISTERS
          50: REPORT_WO_FISCAL_CLOSURE_WO_REGISTERS
          51: REPORT_WO_FISCAL_CLOSURE_WITH_REGISTERS
          52: CASH_REGISTER_REPORT
          default: FISCAL_CLOSURE_WITH_REGISTERS
     }
```

## Payload Comparison

Class: `ecr.ecrcommunication.commands.reports.DailyClosureReport`

Constructor:

```java
DailyClosureReport()
DailyClosureReport(DailyClosureReportOptionEnum option)
```

Inheritance:

```text
class ecr.ecrcommunication.commands.reports.DailyClosureReport
  extends ecr.ecrcommunication.core.AEcrCommand
```

Command:

| CommandsEnum | Command ID |
|---|---:|
| `DAILY_FINANCIAL_REPORT` | `0x45` / decimal `69` |

Command ID bytecode evidence:

```text
CommandsEnum.<clinit>()
  429: ldc "DAILY_FINANCIAL_REPORT"
  431: bipush 27
  433: bipush 69
  435: invokespecial CommandsEnum.<init>
  438: putstatic CommandsEnum.DAILY_FINANCIAL_REPORT
```

Printer-device payloads:

| Java option | Payload chars | Payload bytes |
|---|---|---|
| `REPORT_WO_FISCAL_CLOSURE_WO_REGISTERS` | `2` | `32` |
| `REPORT_WO_FISCAL_CLOSURE_WITH_REGISTERS` | `3` | `33` |

Cash-register-device payloads:

| Java option | Payload chars | Payload bytes |
|---|---|---|
| `REPORT_WO_FISCAL_CLOSURE_WO_REGISTERS` | `X<TAB>` | `58 09` |
| `REPORT_WO_FISCAL_CLOSURE_WITH_REGISTERS` | `X<TAB>` | `58 09` |

Important distinction:

For `DeviceTypeEnum.PRINTER`, the normal and extended X Report variants are byte-different: `0x32` versus `0x33`.

For `DeviceTypeEnum.CASH_REGISTER`, Java collapses both X Report enum values to the same payload: `X<TAB>`.

## Extended X Report

The extended X Report is created by passing:

```java
DailyClosureReportOptionEnum.REPORT_WO_FISCAL_CLOSURE_WITH_REGISTERS
```

For fiscal printer devices, `DailyClosureReport.toIntList()` appends:

```text
ASCII char: 3
Decimal:    51
Hex:        33
```

This is the Java path that corresponds to the observed device printout:

```text
ПРОШИРЕН КОНТРОЛЕН ИЗВЕШТАЈ
```

Bytecode evidence from `ReportsPanel$1$1.run()`:

```text
selectedIndex == 3
  getstatic DailyClosureReportOptionEnum.REPORT_WO_FISCAL_CLOSURE_WITH_REGISTERS
  invokevirtual Ecr.dailyClosure(DailyClosureReportOptionEnum)
```

Bytecode evidence from `DailyClosureReport.toIntList()`:

```text
DeviceTypeEnum.PRINTER branch:
  17: aload_1
  19: aload_0
  20: getfield option
  22: invokevirtual DailyClosureReportOptionEnum.getValue()C
  25: invokestatic Integer.valueOf(I)
  28: invokeinterface List.add
```

Java equivalent pseudocode:

```java
// UI selected report index 3
Constants.ECR.dailyClosure(
    DailyClosureReportOptionEnum.REPORT_WO_FISCAL_CLOSURE_WITH_REGISTERS);

// Command builder, fiscal printer device
payload.add((int) option.getValue()); // '3' / 0x33
```

## Normal X Report

The normal X Report is created by passing:

```java
DailyClosureReportOptionEnum.REPORT_WO_FISCAL_CLOSURE_WO_REGISTERS
```

For fiscal printer devices, `DailyClosureReport.toIntList()` appends:

```text
ASCII char: 2
Decimal:    50
Hex:        32
```

This is the Java path that corresponds to the observed device printout:

```text
КОНТРОЛЕН ИЗВЕШТАЈ
```

Bytecode evidence from `ReportsPanel$1$1.run()`:

```text
selectedIndex == 1
  getstatic DailyClosureReportOptionEnum.REPORT_WO_FISCAL_CLOSURE_WO_REGISTERS
  invokevirtual Ecr.dailyClosure(DailyClosureReportOptionEnum)
```

Bytecode evidence from `DailyClosureReport.toIntList()`:

```text
DeviceTypeEnum.PRINTER branch:
  payload.add(Integer.valueOf(option.getValue()))
```

Java equivalent pseudocode:

```java
// UI selected report index 1
Constants.ECR.dailyClosure(
    DailyClosureReportOptionEnum.REPORT_WO_FISCAL_CLOSURE_WO_REGISTERS);

// Command builder, fiscal printer device
payload.add((int) option.getValue()); // '2' / 0x32
```

## UI Workflow

UI class: `ecr.ui.panels.ReportsPanel`

Worker class: `ecr.ui.panels.ReportsPanel$1$1`

The report combo box is selected by index. The execute-button worker maps selected indices to `Ecr.dailyClosure(...)` calls.

Fiscal printer workflow:

| UI selected index | Java call | Report result |
|---:|---|---|
| `1` | `dailyClosure(REPORT_WO_FISCAL_CLOSURE_WO_REGISTERS)` | Normal X Report |
| `3` | `dailyClosure(REPORT_WO_FISCAL_CLOSURE_WITH_REGISTERS)` | Extended X Report |

Bytecode evidence:

```text
ReportsPanel$1$1.run()
  63: getstatic Constants.deviceType
  66: getstatic DeviceTypeEnum.PRINTER
  69: if_acmpne -> 591

  selectedIndex == 1:
    getstatic DailyClosureReportOptionEnum.REPORT_WO_FISCAL_CLOSURE_WO_REGISTERS
    invokevirtual Ecr.dailyClosure

  selectedIndex == 3:
    getstatic DailyClosureReportOptionEnum.REPORT_WO_FISCAL_CLOSURE_WITH_REGISTERS
    invokevirtual Ecr.dailyClosure
```

Cash-register workflow:

| UI selected index | Java call | Payload from command builder |
|---:|---|---|
| `1` | `dailyClosure(REPORT_WO_FISCAL_CLOSURE_WO_REGISTERS)` | `X<TAB>` |
| `3` | `dailyClosure(REPORT_WO_FISCAL_CLOSURE_WITH_REGISTERS)` | `X<TAB>` |

Bytecode evidence:

```text
ReportsPanel$1$1.run()
  591: getstatic Constants.deviceType
  594: getstatic DeviceTypeEnum.CASH_REGISTER

  selectedIndex == 1:
    getstatic DailyClosureReportOptionEnum.REPORT_WO_FISCAL_CLOSURE_WO_REGISTERS
    invokevirtual Ecr.dailyClosure

  selectedIndex == 3:
    getstatic DailyClosureReportOptionEnum.REPORT_WO_FISCAL_CLOSURE_WITH_REGISTERS
    invokevirtual Ecr.dailyClosure
```

## Bytecode Evidence

### Constructor

```text
DailyClosureReport.<init>()V
  1: getstatic CommandsEnum.DAILY_FINANCIAL_REPORT
  4: invokespecial AEcrCommand.<init>(CommandsEnum)
  8: getstatic DailyClosureReportOptionEnum.FISCAL_CLOSURE_WITH_REGISTERS
  11: putfield option

DailyClosureReport.<init>(DailyClosureReportOptionEnum)V
  1: getstatic CommandsEnum.DAILY_FINANCIAL_REPORT
  4: invokespecial AEcrCommand.<init>(CommandsEnum)
  8: getstatic DailyClosureReportOptionEnum.FISCAL_CLOSURE_WITH_REGISTERS
  11: putfield option
  15: aload_1
  16: putfield option
```

### Option Setter

```text
DailyClosureReport.setOption(DailyClosureReportOptionEnum)
  if option is non-null:
    putfield option
  else:
    new Exception("NULL value is not allwoed")
```

### Payload Builder

```text
DailyClosureReport.toIntList()
  0: new ArrayList
  8: getstatic Constants.deviceType
  11: getstatic DeviceTypeEnum.PRINTER
  14: if_acmpne -> 37
  17: aload_1
  19: aload_0
  20: getfield option
  22: invokevirtual DailyClosureReportOptionEnum.getValue()C
  25: invokestatic Integer.valueOf(I)
  28: invokeinterface List.add
  34: goto -> 101

  37: getstatic Constants.deviceType
  40: getstatic DeviceTypeEnum.CASH_REGISTER
  43: if_acmpne -> 101
  46: ldc "X"
  48: astore closureType
  49: getfield option
  53: getstatic FISCAL_CLOSURE_WITH_REGISTERS
  56: if_acmpeq -> 69
  59: getfield option
  63: getstatic FISCAL_CLOSURE_WO_REGISTERS
  66: if_acmpne -> 72
  69: ldc "Z"
  71: astore closureType
  72: result.addAll(Utils.getIntListFromString(closureType + "\t"))
```

### Ecr Facade

```text
Ecr.dailyClosure(DailyClosureReportOptionEnum)
  new DailyClosureReport(option)
  ecrSerialPort.sendReceive(command)
```

For `DeviceTypeEnum.PRINTER`, after an `OK` command result, `Ecr.dailyClosure(...)` marks the facade execution status as success. This document does not re-analyze the lower-level response parser.

## Java Pseudocode

```java
enum DailyClosureReportOptionEnum {
    FISCAL_CLOSURE_WO_REGISTERS('0'),
    FISCAL_CLOSURE_WITH_REGISTERS('1'),
    REPORT_WO_FISCAL_CLOSURE_WO_REGISTERS('2'),
    REPORT_WO_FISCAL_CLOSURE_WITH_REGISTERS('3'),
    CASH_REGISTER_REPORT('4');

    private char value;
}
```

```java
class DailyClosureReport extends AEcrCommand {
    private DailyClosureReportOptionEnum option =
        DailyClosureReportOptionEnum.FISCAL_CLOSURE_WITH_REGISTERS;

    DailyClosureReport() {
        super(CommandsEnum.DAILY_FINANCIAL_REPORT); // 0x45
    }

    DailyClosureReport(DailyClosureReportOptionEnum option) {
        super(CommandsEnum.DAILY_FINANCIAL_REPORT); // 0x45
        this.option = option;
    }

    List<Integer> toIntList() {
        List<Integer> result = new ArrayList<>();

        if (Constants.deviceType == DeviceTypeEnum.PRINTER) {
            result.add((int) option.getValue());
            return result;
        }

        if (Constants.deviceType == DeviceTypeEnum.CASH_REGISTER) {
            String closureType = "X";

            if (option == FISCAL_CLOSURE_WITH_REGISTERS ||
                option == FISCAL_CLOSURE_WO_REGISTERS) {
                closureType = "Z";
            }

            result.addAll(Utils.getIntListFromString(closureType + "\t"));
        }

        return result;
    }
}
```

```java
// ReportsPanel$1$1.run(), fiscal printer branch
switch (cmbReportType.getSelectedIndex()) {
    case 1:
        Constants.ECR.dailyClosure(
            DailyClosureReportOptionEnum.REPORT_WO_FISCAL_CLOSURE_WO_REGISTERS);
        break;

    case 3:
        Constants.ECR.dailyClosure(
            DailyClosureReportOptionEnum.REPORT_WO_FISCAL_CLOSURE_WITH_REGISTERS);
        break;
}
```

## Conclusion

The two X Report variants are not different Java command classes and not different command IDs.

They are the same command:

```text
CommandsEnum.DAILY_FINANCIAL_REPORT
Command ID: 0x45 / decimal 69
Class: ecr.ecrcommunication.commands.reports.DailyClosureReport
```

The fiscal printer payload determines the variant:

| Variant | Java enum | Payload byte |
|---|---|---:|
| Normal X Report / `КОНТРОЛЕН ИЗВЕШТАЈ` | `REPORT_WO_FISCAL_CLOSURE_WO_REGISTERS` | ASCII `2` / `0x32` |
| Extended X Report / `ПРОШИРЕН КОНТРОЛЕН ИЗВЕШТАЈ` | `REPORT_WO_FISCAL_CLOSURE_WITH_REGISTERS` | ASCII `3` / `0x33` |

Therefore the Java SDK differentiates the two observed reports by enum parameter and resulting one-byte payload.

## UNKNOWN Section

| Question | Answer |
|---|---|
| Are the exact printed Macedonian titles embedded in the Java SDK? | UNKNOWN. The titles are emitted by firmware; the Java bytecode proves the enum and payload difference, not the printed title text. |
| Why does `DeviceTypeEnum.CASH_REGISTER` collapse both X options to `X<TAB>`? | UNKNOWN. Bytecode proves the collapse; firmware behavior is not proven here. |
| Does firmware interpret printer payload `2` and `3` exactly as normal/extended for all device models? | UNKNOWN beyond the tested device and Java bytecode mapping. |
| Are UI combo-box labels recoverable exactly from the `.class` constants with the current disassembler output? | UNKNOWN. The action-to-enum mapping is proven by bytecode even though Cyrillic labels display as `?` in the disassembly. |
