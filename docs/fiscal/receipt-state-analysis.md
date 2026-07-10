# Receipt State Analysis

## Overview

Scope: this document analyzes only receipt state management evidence in `Ecr-1.7.739.jar`.

Out of scope by request: packet framing, checksum, serial communication, receipt payload builders, receipt printing flow, and status commands already documented elsewhere. This document mentions `Ecr.readStatus()` only where Java uses its resulting state flags to decide receipt-state behavior.

Target commands:

| Command | Finding |
|---|---|
| `GET_INFO_CURRENT_RECEIPT` | Present in `CommandsEnum`; no Java command class or application caller found |
| `GET_LAST_PRINTED_DOCUMENT_INFO` | Implemented by `GetLastPrintedDocumentInfo`; exposed through `Ecr.getLastPrintedDocumentInfo()`; used by `ReportsPanel$2$1` |
| `GET_FISCAL_TRANSACTION_STATUS` | Implemented by `GetFiscalReceiptStatus`; used directly by `FiscalReceiptPanel$12$1` |

Whole-JAR search conclusion: Java does not build a rich `CurrentReceipt`, `ReceiptInfo`, `DocumentInfo`, or `TransactionStatus` object for these commands. The proven outputs are raw decoded strings and two parsed numeric fields in one UI worker.

## Command Table

| Command | Java class | Package | CommandsEnum | Command ID | Payload | Response object |
|---|---|---|---|---:|---|---|
| `GET_INFO_CURRENT_RECEIPT` | UNKNOWN | UNKNOWN | `GET_INFO_CURRENT_RECEIPT` | `103` / `0x67` | UNKNOWN | UNKNOWN |
| `GET_LAST_PRINTED_DOCUMENT_INFO` | `GetLastPrintedDocumentInfo` | `ecr.ecrcommunication.commands.info` | `GET_LAST_PRINTED_DOCUMENT_INFO` | `113` / `0x71` | Empty string encoded by `Utils.getIntListFromString("")` | `String` stored in `EcrResponseExecutionStatus.responseObject` |
| `GET_FISCAL_TRANSACTION_STATUS` | `GetFiscalReceiptStatus` | `ecr.ecrcommunication.commands.fiscalreceipt` | `GET_FISCAL_TRANSACTION_STATUS` | `76` / `0x4C` | `"T"` encoded by `Utils.getIntListFromString("T")` | No object; UI parses `response.getData()` locally |

Command ID bytecode evidence from `CommandsEnum.<clinit>()`:

```text
653: ldc "GET_FISCAL_TRANSACTION_STATUS"
655: bipush 41
657: bipush 76
659: invokespecial CommandsEnum.<init>(String,int,int)

717: ldc "GET_INFO_CURRENT_RECEIPT"
719: bipush 45
721: bipush 103
723: invokespecial CommandsEnum.<init>(String,int,int)

765: ldc "GET_LAST_PRINTED_DOCUMENT_INFO"
767: bipush 48
769: bipush 113
771: invokespecial CommandsEnum.<init>(String,int,int)
```

Java-equivalent enum pseudocode:

```java
GET_FISCAL_TRANSACTION_STATUS(76);
GET_INFO_CURRENT_RECEIPT(103);
GET_LAST_PRINTED_DOCUMENT_INFO(113);
```

## Whole-JAR Search

Evidence source: complete class-file search under `Ecr-1.7.739/ecr-expanded-3`.

| Search term | Matches |
|---|---|
| `GET_INFO_CURRENT_RECEIPT` | `CommandsEnum.class` |
| `GET_LAST_PRINTED_DOCUMENT_INFO` | `GetLastPrintedDocumentInfo.class`, `CommandsEnum.class` |
| `GET_FISCAL_TRANSACTION_STATUS` | `CommandsEnum.class`, `GetFiscalReceiptStatus.class` |
| `GetInfoCurrentReceipt` | No match |
| `GetLastPrintedDocumentInfo` | `Ecr.class`, `GetLastPrintedDocumentInfo.class` |
| `GetFiscalTransactionStatus` | No match |
| `CurrentReceipt` | No match |
| `LastReceipt` | `FiscalDeviceCollab.class`, `AcceptanceSynchronizationPanel$2$1.class`; no target command usage found |
| `ReceiptInfo` | No match |
| `TransactionStatus` | No match |
| `DocumentInfo` | `Ecr.class`, `GetLastPrintedDocumentInfo.class`, `ReportsPanel$2$1.class` |
| `ReceiptNumber` | `Fiscalization.class`, `FiscalDeviceCollab.class`, `AcceptanceSynchronizationPanel$2$1.class`; no target command parsing found |
| `SlipNumber` | No match |
| `FiscalNumber` | No match |
| `InvoiceNumber` | No match |
| `ReceiptState` | No match |
| `ReceiptStatus` | `GetFiscalReceiptStatus.class`, `FiscalReceiptPanel$12$1.class`, `FiscalReceiptPanel.class` |
| `ReceiptOpen` | No match |
| `ReceiptClosed` | No match |
| `Duplicate` | `PrintDuplicateFiscalReceipt.class` |
| `FiscalReceiptStatus` | `GetFiscalReceiptStatus.class`, `FiscalReceiptPanel$12$1.class` |

## Java Classes

### GET_INFO_CURRENT_RECEIPT

| Item | Value |
|---|---|
| Java class | UNKNOWN |
| Package | UNKNOWN |
| Constructor | UNKNOWN |
| Inheritance | UNKNOWN |
| Interfaces | UNKNOWN |
| CommandsEnum | `GET_INFO_CURRENT_RECEIPT` |
| Command ID | `103` / `0x67` |

Evidence:

```text
GET_INFO_CURRENT_RECEIPT appears in CommandsEnum.class only.
GetInfoCurrentReceipt: NO MATCH.
CurrentReceipt: NO MATCH.
```

Java-equivalent pseudocode:

```java
// No Java AEcrCommand subclass for GET_INFO_CURRENT_RECEIPT was found.
// No call site using CommandsEnum.GET_INFO_CURRENT_RECEIPT was found.
```

Conclusion: the enum reserves command ID `103`, but this JAR does not prove a payload builder, response parser, or application workflow for it.

### GetLastPrintedDocumentInfo

| Item | Value |
|---|---|
| Java class | `ecr.ecrcommunication.commands.info.GetLastPrintedDocumentInfo` |
| Package | `ecr.ecrcommunication.commands.info` |
| Constructor | `GetLastPrintedDocumentInfo()` |
| Inheritance | `GetLastPrintedDocumentInfo extends AEcrCommand` |
| Interfaces | None |
| CommandsEnum | `GET_LAST_PRINTED_DOCUMENT_INFO` |
| Command ID | `113` / `0x71` |

Constructor bytecode evidence:

```text
0: aload_0
1: getstatic CommandsEnum.GET_LAST_PRINTED_DOCUMENT_INFO
4: invokespecial AEcrCommand.<init>(CommandsEnum)
7: return
```

Java-equivalent pseudocode:

```java
public final class GetLastPrintedDocumentInfo extends AEcrCommand {
    public GetLastPrintedDocumentInfo() {
        super(CommandsEnum.GET_LAST_PRINTED_DOCUMENT_INFO);
    }
}
```

### GetFiscalReceiptStatus

| Item | Value |
|---|---|
| Java class | `ecr.ecrcommunication.commands.fiscalreceipt.GetFiscalReceiptStatus` |
| Package | `ecr.ecrcommunication.commands.fiscalreceipt` |
| Constructor | `GetFiscalReceiptStatus()` |
| Inheritance | `GetFiscalReceiptStatus extends AEcrCommand` |
| Interfaces | None |
| CommandsEnum | `GET_FISCAL_TRANSACTION_STATUS` |
| Command ID | `76` / `0x4C` |

Constructor bytecode evidence:

```text
0: aload_0
1: getstatic CommandsEnum.GET_FISCAL_TRANSACTION_STATUS
4: invokespecial AEcrCommand.<init>(CommandsEnum)
7: return
```

Java-equivalent pseudocode:

```java
public final class GetFiscalReceiptStatus extends AEcrCommand {
    public GetFiscalReceiptStatus() {
        super(CommandsEnum.GET_FISCAL_TRANSACTION_STATUS);
    }
}
```

## Payloads

### GET_INFO_CURRENT_RECEIPT

Payload builder: UNKNOWN.

Evidence: no concrete Java class was found. No `toIntList()` implementation for this enum was found.

### GET_LAST_PRINTED_DOCUMENT_INFO

Class/method: `GetLastPrintedDocumentInfo.toIntList()`

Bytecode evidence:

```text
0: ldc ""
2: invokestatic Utils.getIntListFromString(String):List
5: areturn
```

Payload table:

| Field | Value |
|---|---|
| Input parameters | None |
| Payload string | Empty string |
| Separators | None |
| Encoding helper | `Utils.getIntListFromString("")` |
| Validation | None found |

Java-equivalent pseudocode:

```java
public List<Integer> toIntList() {
    return Utils.getIntListFromString("");
}
```

### GET_FISCAL_TRANSACTION_STATUS

Class/method: `GetFiscalReceiptStatus.toIntList()`

Bytecode evidence:

```text
0: ldc "T"
2: invokestatic Utils.getIntListFromString(String):List
5: areturn
```

Payload table:

| Field | Value |
|---|---|
| Input parameters | None |
| Payload string | `T` |
| Separators | None |
| Encoding helper | `Utils.getIntListFromString("T")` |
| Validation | None found |

Java-equivalent pseudocode:

```java
public List<Integer> toIntList() {
    return Utils.getIntListFromString("T");
}
```

## Responses

### Shared Wrapper Object

Class: `ecr.ecrcommunication.enums.EcrResponseExecutionStatus`

Fields proven by bytecode:

| Field | Type | Default |
|---|---|---|
| `ecrResponseExecutionStatusEnum` | `EcrResponseExecutionStatusEnum` | `UNKNOWN` in default constructor |
| `responseObject` | `Object` | `null` |

Relevant methods:

```text
getEcrResponseExecutionStatusEnum()
setEcrResponseExecutionStatusEnum(...)
getResponseObject()
setResponseObject(Object)
```

Java-equivalent pseudocode:

```java
public class EcrResponseExecutionStatus {
    private EcrResponseExecutionStatusEnum ecrResponseExecutionStatusEnum = UNKNOWN;
    private Object responseObject = null;
}
```

### GET_INFO_CURRENT_RECEIPT

Response parsing: UNKNOWN.

Evidence: no Java command class and no application caller were found.

| Response part | Java usage |
|---|---|
| `response.getData()` | UNKNOWN |
| `response.getStatus()` | UNKNOWN |
| Helper methods | UNKNOWN |
| Returned object | UNKNOWN |

### GET_LAST_PRINTED_DOCUMENT_INFO

Class/method: `Ecr.getLastPrintedDocumentInfo()`

Bytecode evidence:

```text
new EcrResponseExecutionStatus(ERROR)
ecrSerialPort.sendReceive(new GetLastPrintedDocumentInfo())
response.getResult()
if result == EcrResponseEnum.OK:
  response.getData()
  if data != null && data.size() > 0:
    Utils.getStringFromIntList(response.getData())
    setEcrResponseExecutionStatusEnum(SUCCESS)
    setResponseObject(str)
```

Java-equivalent pseudocode:

```java
public EcrResponseExecutionStatus getLastPrintedDocumentInfo() throws Exception {
    EcrResponseExecutionStatus status =
        new EcrResponseExecutionStatus(EcrResponseExecutionStatusEnum.ERROR);

    EcrResponse response =
        ecrSerialPort.sendReceive(new GetLastPrintedDocumentInfo());

    if (response.getResult() == EcrResponseEnum.OK &&
        response.getData() != null &&
        response.getData().size() > 0) {
        String str = Utils.getStringFromIntList(response.getData());
        status.setEcrResponseExecutionStatusEnum(EcrResponseExecutionStatusEnum.SUCCESS);
        status.setResponseObject(str);
    }

    return status;
}
```

Parsing table:

| Step | Java behavior |
|---|---|
| Result check | Requires `response.getResult() == EcrResponseEnum.OK` |
| Data null check | Requires `response.getData() != null` |
| Data length check | Requires `response.getData().size() > 0` |
| Data conversion | `Utils.getStringFromIntList(response.getData())` |
| Split/parsing | None |
| Returned object | Raw decoded `String` |
| `response.getStatus()` | Not read |

Exception behavior:

```text
EcrOfflineException -> logged with "Ecr.getLastPrintedDocumentInfo() EcrOfflineException thrown:" and rethrown
Exception -> logged with "Ecr.getLastPrintedDocumentInfo() Exeption thrown:" and rethrown
```

### GET_FISCAL_TRANSACTION_STATUS

Class/method: `FiscalReceiptPanel$12$1.run()`

This command is not wrapped by a dedicated `Ecr.getFiscalTransactionStatus()` facade method in the searched bytecode. The UI worker calls `Constants.ECR.sendReceive(new GetFiscalReceiptStatus())` directly.

Bytecode evidence:

```text
119: getstatic Constants.ECR
122: new GetFiscalReceiptStatus
126: invokespecial GetFiscalReceiptStatus.<init>()
129: invokevirtual Ecr.sendReceive(AEcrCommand):EcrResponse
132: astore_3

137: response.getResult()
141: getstatic EcrResponseEnum.OK
144: if_acmpne -> error
147: response.getData()
151: ifnull -> error
154: response.getData()
158: invokestatic Utils.getStringFromIntList(List):String
163: str.split(separator)
176: s.arraylength
179: iconst_4
180: if_icmplt -> error
189: Double.parseDouble(s[2])
222: Double.parseDouble(s[3])
263: new DecimalFormat("0.00")
284: df.format(amount - tender)
294: txtStornaCashNumber.setText(...)
```

Java-equivalent pseudocode:

```java
String separator = ",";
if (Constants.deviceType == DeviceTypeEnum.CASH_REGISTER) {
    separator = "\t";
}

EcrResponse response =
    Constants.ECR.sendReceive(new GetFiscalReceiptStatus());

if (response == null) throw new Exception();
if (response.getResult() != EcrResponseEnum.OK) throw new Exception();
if (response.getData() == null) throw new Exception();

String str = Utils.getStringFromIntList(response.getData());
String[] s = str.split(separator);
if (s == null || s.length < 4) throw new Exception();

double amount = Double.parseDouble(s[2]);
if (Constants.deviceType == DeviceTypeEnum.PRINTER && amount > 0) {
    amount = amount / 100.0;
}

double tender = Double.parseDouble(s[3]);
if (Constants.deviceType == DeviceTypeEnum.PRINTER && tender > 0) {
    tender = tender / 100.0;
}

txtStornaCashNumber.setText(new DecimalFormat("0.00").format(amount - tender));
```

Parsing table:

| Step | Java behavior |
|---|---|
| Result check | Requires `response.getResult() == EcrResponseEnum.OK` |
| Data null check | Requires `response.getData() != null` |
| Data conversion | `Utils.getStringFromIntList(response.getData())` |
| Separator for `PRINTER` | comma `,` |
| Separator for `CASH_REGISTER` | tab `\t` |
| Minimum field count | `s.length >= 4` |
| Parsed field `s[0]` | UNKNOWN |
| Parsed field `s[1]` | UNKNOWN |
| Parsed field `s[2]` | Local variable name `amount` |
| Parsed field `s[3]` | Local variable name `tender` |
| Printer scaling | If parsed value is positive, divide `amount` and `tender` by `100.0` |
| Cash-register scaling | No divide-by-100 code found |
| Displayed value | `DecimalFormat("0.00").format(amount - tender)` |
| `response.getStatus()` | Not read |
| Returned object | None |

## Parsed Fields

### GET_LAST_PRINTED_DOCUMENT_INFO

Java extracts only one field:

| Java field | Source | Meaning proven by Java |
|---|---|---|
| `str` | `Utils.getStringFromIntList(response.getData())` | Raw decoded last printed document info string |

No Java evidence was found that splits the string into receipt number, fiscal number, slip number, operator, date, time, document number, receipt state, or flags.

### GET_FISCAL_TRANSACTION_STATUS

Java parses only these fields from the decoded response string:

| Response token | Java local variable | Post-processing | Proven usage |
|---|---|---|---|
| `s[0]` | None | None | UNKNOWN |
| `s[1]` | None | None | UNKNOWN |
| `s[2]` | `amount` | Printer positive values divided by `100.0` | Used in `amount - tender` |
| `s[3]` | `tender` | Printer positive values divided by `100.0` | Used in `amount - tender` |

Displayed field:

| UI field | Source | Meaning proven by Java |
|---|---|---|
| `FiscalReceiptPanel.txtStornaCashNumber` | `DecimalFormat("0.00").format(amount - tender)` | Numeric difference between parsed `amount` and parsed `tender` |

No Java evidence was found that parses receipt number, fiscal number, slip number, operator, date, time, receipt state, document number, transaction result, or flags from `GET_FISCAL_TRANSACTION_STATUS`.

## Workflow

### GET_INFO_CURRENT_RECEIPT

Application workflow: UNKNOWN.

Evidence: no caller was found.

### GET_LAST_PRINTED_DOCUMENT_INFO

Call flow:

```text
ReportsPanel.getBtnRead()
  -> ReportsPanel$2.actionPerformed(...)
    -> starts ReportsPanel$2$1 Runnable
      -> ReportsPanel$2$1.run()
        -> Constants.ECR.getLastPrintedDocumentInfo()
          -> Ecr.getLastPrintedDocumentInfo()
            -> EcrSerialPort.sendReceive(new GetLastPrintedDocumentInfo())
            -> Utils.getStringFromIntList(response.getData())
            -> EcrResponseExecutionStatus.responseObject = decoded string
        -> txtPrinterStatus.setText(responseObject.toString())
```

Application usage bytecode evidence from `ReportsPanel$2$1.run()`:

```text
194: getstatic Constants.ECR
197: invokevirtual Ecr.getLastPrintedDocumentInfo():EcrResponseExecutionStatus
200: astore_1
201: ReportsPanel.access$600(...)
211: result.getResponseObject()
215: Object.toString()
218: EcrTextField.setText(String)
```

Device/UI condition:

| Condition | Behavior |
|---|---|
| `Constants.deviceType == PRINTER` and read-status combo index `2` | Calls `getLastPrintedDocumentInfo()` |
| `Constants.deviceType == CASH_REGISTER` | Read-status combo model has only one item; this worker does not call `getLastPrintedDocumentInfo()` in the cash-register branch |

Workflow purpose proven by Java: diagnostics/display in `ReportsPanel`. No before-receipt, after-receipt, recovery, or automatic duplicate workflow was found.

### GET_FISCAL_TRANSACTION_STATUS

Call flow:

```text
FiscalReceiptPanel.getButton()          // check button
  -> FiscalReceiptPanel$12.actionPerformed(...)
    -> starts FiscalReceiptPanel$12$1 Runnable
      -> Constants.ECR.readStatus()
      -> checks Constants.OPENED_FISCAL__OR_VOID_RECEIPT
      -> if open:
           sets receipt status UI background red
           checks Constants.OPENED_VOID_RECEIPT
           sends GetFiscalReceiptStatus
           parses response.getData() tokens
           sets txtStornaCashNumber = amount - tender
      -> if not open:
           sets receipt status UI background green
           clears void checkbox
           sets txtStornaCashNumber = "0.00"
```

State-gate bytecode evidence:

```text
0: getstatic Constants.ECR
3: invokevirtual Ecr.readStatus()
7: result.getEcrResponseExecutionStatusEnum()
11: getstatic EcrResponseExecutionStatusEnum.SUCCESS
14: if_acmpne -> 406
17: getstatic Constants.OPENED_FISCAL__OR_VOID_RECEIPT
20: ifeq -> 361
```

Open-state UI behavior:

```text
if Constants.OPENED_FISCAL__OR_VOID_RECEIPT:
  txtReceiptStatus.setBackground(Color.RED)
  if Constants.OPENED_VOID_RECEIPT:
      chkIsStorna.setSelected(true)
      txtStornaCashNumber.setEnabled(true)
  else:
      chkIsStorna.setSelected(false)
      txtStornaCashNumber.setEnabled(false)
```

Closed-state UI behavior:

```text
if not Constants.OPENED_FISCAL__OR_VOID_RECEIPT:
  txtReceiptStatus.setBackground(Color.GREEN)
  chkIsStorna.setSelected(false)
  txtStornaCashNumber.setText("0.00")
```

Button availability evidence:

```text
FiscalReceiptPanel.getButton():
  if Constants.deviceType == PRINTER:
      btnCheck.setEnabled(true)
  else:
      btnCheck.setEnabled(false)
```

Workflow purpose proven by Java: manual UI check of an open receipt/void receipt state, with optional transaction-status amount/tender display. No automatic recovery caller was found.

## Recovery

Receipt recovery findings:

| Question | Java evidence |
|---|---|
| Is there an open receipt? | `FiscalReceiptPanel$12$1.run()` calls `Ecr.readStatus()` and checks `Constants.OPENED_FISCAL__OR_VOID_RECEIPT` |
| Is the open receipt a void receipt? | Same worker checks `Constants.OPENED_VOID_RECEIPT` |
| Was the previous receipt closed? | No target command proves this; closed state is inferred only from the current open-receipt flag being false |
| Was the previous transaction successful? | UNKNOWN; no target command parses a success/result field |
| Can duplicate printing be triggered automatically? | No automatic caller found |
| Can recovery continue after restart? | UNKNOWN; no persisted `CurrentReceipt` or recovery object was found |

State flags:

| Flag | Default | Updated by |
|---|---|---|
| `Constants.OPENED_FISCAL__OR_VOID_RECEIPT` | `false` in `Constants.<clinit>()` | `Ecr.readStatus()` |
| `Constants.OPENED_VOID_RECEIPT` | `false` in `Constants.<clinit>()` | `Ecr.readStatus()` when an open fiscal/void receipt is detected |

Flag-update bytecode evidence:

```text
Constants.<clinit>:
414: iconst_0
414: putstatic Constants.OPENED_FISCAL__OR_VOID_RECEIPT
417: iconst_0
418: putstatic Constants.OPENED_VOID_RECEIPT
```

Printer flag evidence in `Ecr.readStatus()`:

```text
byte2.charAt(4) == '1' -> Constants.OPENED_FISCAL__OR_VOID_RECEIPT
if open:
  byte1.charAt(4) == '1' -> Constants.OPENED_VOID_RECEIPT
```

Cash-register flag evidence in `Ecr.readStatus()`:

```text
byte2.charAt(2) == '1' || byte2.charAt(4) == '1'
  -> Constants.OPENED_FISCAL__OR_VOID_RECEIPT
if open:
  byte1.charAt(2) == '1' -> Constants.OPENED_VOID_RECEIPT
```

This document does not analyze the status command protocol. The only receipt-state conclusion is that these two booleans are the Java SDK's in-memory open/void receipt flags.

Duplicate printing:

| Item | Evidence |
|---|---|
| Command class | `ecr.ecrcommunication.commands.fiscalreceipt.PrintDuplicateFiscalReceipt` |
| CommandsEnum | `PRINT_DUPLICATE` |
| Command ID | `109` / `0x6D` |
| Payload | `"1"` via `Utils.getIntListFromString("1")` |
| Automatic caller | None found in whole-JAR search |
| Relation to target state commands | None found |

Conclusion: duplicate printing exists as a command class, but Java evidence did not show automatic duplicate printing after checking receipt state.

## Application Usage

| Command / enum | Application classes using it |
|---|---|
| `GET_INFO_CURRENT_RECEIPT` | No caller found |
| `GET_LAST_PRINTED_DOCUMENT_INFO` | `Ecr.getLastPrintedDocumentInfo()`, `ReportsPanel$2$1.run()` |
| `GET_FISCAL_TRANSACTION_STATUS` | `GetFiscalReceiptStatus` command class, `FiscalReceiptPanel$12$1.run()` |
| `PRINT_DUPLICATE` | `PrintDuplicateFiscalReceipt` command class only; no application caller found |

UI usage table:

| UI class | Trigger | State command used | Output |
|---|---|---|---|
| `ReportsPanel$2$1` | Read button, printer read-status combo index `2` | `GET_LAST_PRINTED_DOCUMENT_INFO` | Raw decoded string displayed in `txtPrinterStatus` |
| `FiscalReceiptPanel$12$1` | Check button | `GET_FISCAL_TRANSACTION_STATUS`, but only after `readStatus()` says receipt is open | `txtReceiptStatus` color, `chkIsStorna`, `txtStornaCashNumber` |

No service, background worker, or receipt-printing worker was found using these three target commands for automatic before-print or after-print state management.

## Bytecode Evidence

### GetLastPrintedDocumentInfo.toIntList

```text
class ecr.ecrcommunication.commands.info.GetLastPrintedDocumentInfo extends AEcrCommand
interfaces []

METHOD toIntList()Ljava/util/List;
  0: ldc ""
  2: invokestatic Utils.getIntListFromString(String):List
  5: areturn
```

### Ecr.getLastPrintedDocumentInfo

```text
15: new GetLastPrintedDocumentInfo
19: invokespecial GetLastPrintedDocumentInfo.<init>()
22: invokevirtual EcrSerialPort.sendReceive(AEcrCommand):EcrResponse
26: response.getResult()
30: getstatic EcrResponseEnum.OK
36: response.getData()
47: response.getData().size()
59: invokestatic Utils.getStringFromIntList(List):String
64: getstatic EcrResponseExecutionStatusEnum.SUCCESS
67: setEcrResponseExecutionStatusEnum(SUCCESS)
72: setResponseObject(str)
```

### GetFiscalReceiptStatus.toIntList

```text
class ecr.ecrcommunication.commands.fiscalreceipt.GetFiscalReceiptStatus extends AEcrCommand
interfaces []

METHOD toIntList()Ljava/util/List;
  0: ldc "T"
  2: invokestatic Utils.getIntListFromString(String):List
  5: areturn
```

### FiscalReceiptPanel$12$1 Transaction Parsing

```text
154: response.getData()
158: Utils.getStringFromIntList(List)
163: str.split(separator)
176: s.arraylength
179: iconst_4
189: Double.parseDouble(s[2])
198: if device == PRINTER and amount > 0
214: amount / 100.0
222: Double.parseDouble(s[3])
231: if device == PRINTER and tender > 0
247: tender / 100.0
263: new DecimalFormat("0.00")
284: df.format(amount - tender)
294: txtStornaCashNumber.setText(...)
```

## Java Pseudocode

### Last Printed Document Info

```java
EcrResponseExecutionStatus result = new EcrResponseExecutionStatus(ERROR);
EcrResponse response = ecrSerialPort.sendReceive(new GetLastPrintedDocumentInfo());

if (response.getResult() == OK &&
    response.getData() != null &&
    response.getData().size() > 0) {
    String decoded = Utils.getStringFromIntList(response.getData());
    result.setEcrResponseExecutionStatusEnum(SUCCESS);
    result.setResponseObject(decoded);
}

return result;
```

### Fiscal Transaction Status UI Check

```java
EcrResponseExecutionStatus status = Constants.ECR.readStatus();

if (status.getEcrResponseExecutionStatusEnum() == SUCCESS) {
    if (Constants.OPENED_FISCAL__OR_VOID_RECEIPT) {
        txtReceiptStatus.setBackground(Color.RED);
        chkIsStorna.setSelected(Constants.OPENED_VOID_RECEIPT);
        txtStornaCashNumber.setEnabled(Constants.OPENED_VOID_RECEIPT);

        String separator = Constants.deviceType == CASH_REGISTER ? "\t" : ",";
        EcrResponse response = Constants.ECR.sendReceive(new GetFiscalReceiptStatus());

        String decoded = Utils.getStringFromIntList(response.getData());
        String[] s = decoded.split(separator);

        double amount = Double.parseDouble(s[2]);
        double tender = Double.parseDouble(s[3]);

        if (Constants.deviceType == PRINTER) {
            if (amount > 0) amount /= 100.0;
            if (tender > 0) tender /= 100.0;
        }

        txtStornaCashNumber.setText(new DecimalFormat("0.00").format(amount - tender));
    } else {
        txtReceiptStatus.setBackground(Color.GREEN);
        chkIsStorna.setSelected(false);
        txtStornaCashNumber.setText("0.00");
    }
}
```

## Examples

### GET_LAST_PRINTED_DOCUMENT_INFO

Bytecode allows only this decoded structure:

```text
response.getData() bytes -> Utils.getStringFromIntList(...) -> raw String
```

Example:

| Decoded response data | Java returned object |
|---|---|
| `ABC,123,XYZ` | String `"ABC,123,XYZ"` |

Java does not split this into fields. Any receipt number, fiscal number, slip number, date, time, operator, state, or document number inside the string is UNKNOWN to Java code.

### GET_FISCAL_TRANSACTION_STATUS: Printer

Bytecode-proven structure:

```text
decoded data split by ","
s[2] = amount
s[3] = tender
if positive, both are divided by 100
display = amount - tender formatted 0.00
```

Example:

| Decoded data | Tokens | Java display calculation |
|---|---|---|
| `A,B,12345,2345` | `s[2]=12345`, `s[3]=2345` | `(12345 / 100) - (2345 / 100) = 100.00` |

Meaning of `A` and `B`: UNKNOWN.

### GET_FISCAL_TRANSACTION_STATUS: Cash Register

Bytecode-proven structure:

```text
decoded data split by tab
s[2] = amount
s[3] = tender
no divide-by-100
display = amount - tender formatted 0.00
```

Example:

| Decoded data | Tokens | Java display calculation |
|---|---|---|
| `A<TAB>B<TAB>123.45<TAB>23.45` | `s[2]=123.45`, `s[3]=23.45` | `123.45 - 23.45 = 100.00` |

Meaning of `A` and `B`: UNKNOWN.

## UNKNOWN Section

| Topic | Status |
|---|---|
| Java class for `GET_INFO_CURRENT_RECEIPT` | UNKNOWN; not found |
| Payload for `GET_INFO_CURRENT_RECEIPT` | UNKNOWN |
| Response parser for `GET_INFO_CURRENT_RECEIPT` | UNKNOWN |
| Application caller for `GET_INFO_CURRENT_RECEIPT` | UNKNOWN; not found |
| Meaning of `GET_LAST_PRINTED_DOCUMENT_INFO` decoded string fields | UNKNOWN; Java does not split them |
| Receipt number returned by target commands | UNKNOWN |
| Fiscal number returned by target commands | UNKNOWN |
| Slip number returned by target commands | UNKNOWN |
| Invoice number returned by target commands | UNKNOWN |
| Operator returned by target commands | UNKNOWN |
| Date/time returned by target commands | UNKNOWN |
| Receipt state returned by target commands | UNKNOWN |
| Transaction result field from `GET_FISCAL_TRANSACTION_STATUS` | UNKNOWN |
| Meaning of `GET_FISCAL_TRANSACTION_STATUS` tokens `s[0]` and `s[1]` | UNKNOWN |
| Whether `GET_FISCAL_TRANSACTION_STATUS` can prove previous transaction success | UNKNOWN |
| Whether Java checks previous receipt closed using target commands | No evidence found |
| Whether Java automatically triggers duplicate printing | No evidence found |
| Whether Java can continue receipt recovery after restart | UNKNOWN; no persisted current-receipt/recovery object found |
| Any use of `response.getStatus()` by these target command workflows | No evidence found |

