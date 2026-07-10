# Fiscal Receipt Flow Analysis

Scope: this document analyzes only the fiscal receipt workflow in `Ecr-1.7.739.jar`.

Out of scope by request: packet framing, checksum, serial transport mechanics, serial communication behavior, and status command protocol analysis. When receipt code touches shared transport, this document records only how receipt workflow calls it and how returned `EcrResponse` objects are or are not inspected.

Purpose: reverse engineer how the Java SDK performs fiscal receipt printing so the remaining receipt driver can be understood later. This document does not generate .NET code and does not suggest implementation.

Primary evidence files produced during this analysis:

| Evidence file | Purpose |
|---|---|
| `analysis-tools/receipt-term-search.txt` | Whole-JAR search results for the requested receipt terms |
| `analysis-tools/receipt-command-bytecode.txt` | Bytecode for receipt command classes |
| `analysis-tools/receipt-flow-bytecode.txt` | Bytecode for receipt workflow threads and UI worker classes |
| `analysis-tools/ecr-facade-bytecode.txt` | Bytecode for `Ecr.sendReceive(...)` facade and `EcrResponse` |

## Whole-JAR Search Coverage

Class/method: N/A. Evidence: `analysis-tools/receipt-term-search.txt`.

The search was performed across extracted class files under `Ecr-1.7.739/ecr-expanded-3`. The following requested terms were searched in all packages.

| Search term | Matches |
|---|---|
| `OpenFiscalReceipt` | `ecr.ecrcommunication.commands.fiscalreceipt.OpenFiscalReceipt`, `ecr.threads.PrintFiscalReceiptsThread`, `ecr.threads.PrintFiscalReceiptThread`, `ecr.ui.panels.FiscalReceiptPanel$PrintReceiptThread` |
| `ReceiptItem` | `ecr.ecrcommunication.commands.fiscalreceipt.ReceiptItem`, `ecr.threads.PrintFiscalReceiptsThread`, `ecr.threads.PrintFiscalReceiptThread`, `ecr.ui.panels.FiscalReceiptPanel$PrintReceiptThread` |
| `PaymentMethod` | `ecr.ecrcommunication.commands.fiscalreceipt.PaymentMethod`, `ecr.ecrcommunication.commands.info.GetTotal`, `ecr.ecrcommunication.enums.PaymentMethodEnum`, `ecr.threads.PrintFiscalReceiptsThread`, `ecr.threads.PrintFiscalReceiptThread`, `ecr.ui.panels.FiscalReceiptPanel$1$1`, `ecr.ui.panels.FiscalReceiptPanel$PrintReceiptThread` |
| `GetTotal` | `ecr.ecrcommunication.commands.info.GetTotal` |
| `CloseFiscalReceipt` | `ecr.ecrcommunication.commands.fiscalreceipt.CloseFiscalReceipt`, `ecr.threads.PrintFiscalReceiptsThread`, `ecr.threads.PrintFiscalReceiptThread`, `ecr.ui.panels.FiscalReceiptPanel$1$1`, `ecr.ui.panels.FiscalReceiptPanel$PrintReceiptThread` |
| `CancelFiscalReceipt` | `ecr.ecrcommunication.commands.fiscalreceipt.CancelFiscalReceipt`, `ecr.threads.PrintFiscalReceiptsThread`, `ecr.threads.PrintFiscalReceiptThread` |
| `OPEN_FISCAL_RECEIPT` | `OpenFiscalReceipt`, `OpenVoidReceipt`, `CommandsEnum` |
| `REGISTER_SALE` | `ReceiptItem`, `CommandsEnum` |
| `CALCULATE_TOTAL` | `PaymentMethod`, `GetTotal`, `CommandsEnum` |
| `CLOSE_FISCAL_RECEIPT` | `CloseFiscalReceipt`, `CloseVoidReceipt`, `CommandsEnum` |
| `CANCEL_FISCAL_RECEIPT` | `CancelFiscalReceipt`, `CommandsEnum` |
| `sendReceive` | `Ecr`, `EcrSerialPort`, receipt UI/test classes, and other non-receipt UI classes |
| `sendReceiveCommand` | `EcrSerialPort` |
| `Ecr.sendReceive` | No literal match |
| `Receipt` | Multiple receipt command classes and receipt UI classes |
| `FiscalReceipt` | Receipt command classes and receipt UI classes |
| `CurrentReceipt` | No match |
| `ReceiptStatus` | `GetFiscalReceiptStatus`, `FiscalReceiptPanel`, `FiscalReceiptPanel$12$1` |
| `Cancel` | Receipt cancel command and UI/test classes |
| `Payment` | `PaymentMethod`, `PaymentMethodEnum`, receipt UI/test classes |
| `PriceCorrection` | `ReceiptItem`, `PriceCorrectionTypeEnum`, receipt UI classes |
| `Subtotal` | `CommandsEnum` only |
| `Transaction` | Found outside the target receipt workflow. No target workflow usage found. |
| `Duplicate` | `PrintDuplicateFiscalReceipt`, `CommandsEnum` |
| `Recovery` | No match |

Java-equivalent search conclusion:

```java
// Whole-JAR search conclusion:
// The main receipt printing workflow is FiscalReceiptPanel$PrintReceiptThread.run().
// PrintFiscalReceiptThread and PrintFiscalReceiptsThread are demo/test workers.
// No CurrentReceipt class and no Recovery class were found.
```

## Command Summary

| Command | Java class | Command enum | Payload source | Response interpreted by command class |
|---|---|---|---|---|
| `OPEN_FISCAL_RECEIPT` | `ecr.ecrcommunication.commands.fiscalreceipt.OpenFiscalReceipt` | `OPEN_FISCAL_RECEIPT` | `OpenFiscalReceipt.toIntList()` | No |
| `REGISTER_SALE` | `ecr.ecrcommunication.commands.fiscalreceipt.ReceiptItem` | `REGISTER_SALE` | `ReceiptItem.toIntList()` | No |
| `CALCULATE_TOTAL` | `ecr.ecrcommunication.commands.fiscalreceipt.PaymentMethod` | `CALCULATE_TOTAL` | `PaymentMethod.toIntList()` | No |
| `CALCULATE_TOTAL` alternate class | `ecr.ecrcommunication.commands.info.GetTotal` | `CALCULATE_TOTAL` | `GetTotal.toIntList()` | No |
| `CLOSE_FISCAL_RECEIPT` | `ecr.ecrcommunication.commands.fiscalreceipt.CloseFiscalReceipt` | `CLOSE_FISCAL_RECEIPT` | `CloseFiscalReceipt.toIntList()` | No |
| `CANCEL_FISCAL_RECEIPT` | `ecr.ecrcommunication.commands.fiscalreceipt.CancelFiscalReceipt` | `CANCEL_FISCAL_RECEIPT` | `CancelFiscalReceipt.toIntList()` | No |

## Shared Receipt Call Pattern

Class: `ecr.ecrcommunication.Ecr`

Method: `sendReceive(AEcrCommand)`

Bytecode evidence:

```text
aload_0
getfield ecr.ecrcommunication.Ecr.ecrSerialPort
aload_1
invokevirtual ecr.ecrcommunication.EcrSerialPort.sendReceive(AEcrCommand):EcrResponse
areturn
```

Java-equivalent pseudocode:

```java
public EcrResponse sendReceive(AEcrCommand command) throws Exception {
    return this.ecrSerialPort.sendReceive(command);
}
```

Receipt workflow consequence:

| Location | Behavior |
|---|---|
| `FiscalReceiptPanel$PrintReceiptThread.run()` | Calls `Constants.ECR.sendReceive(command)` and immediately discards the returned `EcrResponse` with `pop` |
| `PrintFiscalReceiptThread.run()` | Calls `sendReceive(...)` and discards responses |
| `PrintFiscalReceiptsThread.run()` | Calls `sendReceive(...)` and discards responses |
| `FiscalReceiptPanel$1$1.run()` | Calls `sendReceive(...)` and discards responses |

Response object methods found in `EcrResponse`:

| Method | Return type / field |
|---|---|
| `getResult()` | `EcrResponseEnum` |
| `getData()` | `List<Integer>` |
| `getStatus()` | `List<Integer>` |
| `isCommandError()` | `boolean` |
| `getResponse()` | `String` |
| `getResponseBytes()` | byte array |

How receipt code knows a target command succeeded:

| Evidence | Conclusion |
|---|---|
| Receipt workflow discards `EcrResponse` for open, item, payment, close, and cancel commands | The receipt workflow does not explicitly inspect `response.getResult()`, `response.getData()`, or `response.getStatus()` for these target commands |
| Receipt workflow wraps calls in `try/catch Exception` | Success is treated as "no exception thrown" by `sendReceive(...)` or command validation |
| Command classes have no command-specific response parser | Target command success parsing is UNKNOWN beyond the shared transport returning or throwing |

## OPEN_FISCAL_RECEIPT

### Class

| Field | Value |
|---|---|
| Java class | `ecr.ecrcommunication.commands.fiscalreceipt.OpenFiscalReceipt` |
| Package | `ecr.ecrcommunication.commands.fiscalreceipt` |
| Inheritance | `OpenFiscalReceipt extends AEcrCommand` |
| Interfaces | None found in class declaration |
| Constructors | `OpenFiscalReceipt()`, `OpenFiscalReceipt(boolean testSale)` |
| Command enum | `CommandsEnum.OPEN_FISCAL_RECEIPT` |

Bytecode evidence:

```text
METHOD <init>()V
  getstatic CommandsEnum.OPEN_FISCAL_RECEIPT
  invokespecial AEcrCommand.<init>(CommandsEnum)
  iconst_0
  putfield OpenFiscalReceipt.testSale:Z

METHOD <init>(Z)V
  getstatic CommandsEnum.OPEN_FISCAL_RECEIPT
  invokespecial AEcrCommand.<init>(CommandsEnum)
  iconst_0
  putfield OpenFiscalReceipt.testSale:Z
  iload_1
  putfield OpenFiscalReceipt.testSale:Z
```

Java-equivalent pseudocode:

```java
public class OpenFiscalReceipt extends AEcrCommand {
    private boolean testSale = false;

    public OpenFiscalReceipt() {
        super(CommandsEnum.OPEN_FISCAL_RECEIPT);
        this.testSale = false;
    }

    public OpenFiscalReceipt(boolean testSale) {
        super(CommandsEnum.OPEN_FISCAL_RECEIPT);
        this.testSale = false;
        this.testSale = testSale;
    }
}
```

### Payload Builder

Class/method: `OpenFiscalReceipt.toIntList()`

Bytecode evidence:

```text
0: aconst_null
1: astore_1
2: getstatic Constants.deviceType
5: getstatic DeviceTypeEnum.PRINTER
8: if_acmpne -> 22
11: ldc "1,0000,1"
15: invokestatic Utils.getIntListFromString(String):List
22: getstatic Constants.deviceType
25: getstatic DeviceTypeEnum.CASH_REGISTER
28: if_acmpne -> 39
31: ldc "1\t1\t\t0\t"
35: invokestatic Utils.getIntListFromString(String):List
39: aload_1
40: areturn
```

Payload table:

| Device type | Payload string before encoding | Separators | Encoding |
|---|---|---|---|
| `PRINTER` | `1,0000,1` | comma | `Utils.getIntListFromString(...)` |
| `CASH_REGISTER` | `1\t1\t\t0\t` | tab | `Utils.getIntListFromString(...)` |
| Other / unset | `null` | N/A | N/A |

Every field found:

| Device type | Field order | Literal value |
|---|---|---|
| `PRINTER` | field 1 | `1` |
| `PRINTER` | field 2 | `0000` |
| `PRINTER` | field 3 | `1` |
| `CASH_REGISTER` | field 1 | `1` |
| `CASH_REGISTER` | field 2 | `1` |
| `CASH_REGISTER` | field 3 | empty |
| `CASH_REGISTER` | field 4 | `0` |
| `CASH_REGISTER` | trailing separator | tab |

Java-equivalent pseudocode:

```java
public List<Integer> toIntList() {
    List<Integer> result = null;

    if (Constants.deviceType == DeviceTypeEnum.PRINTER) {
        result = Utils.getIntListFromString("1,0000,1");
    } else if (Constants.deviceType == DeviceTypeEnum.CASH_REGISTER) {
        result = Utils.getIntListFromString("1\t1\t\t0\t");
    }

    return result;
}
```

Example payloads:

| Device type | Example |
|---|---|
| `PRINTER` | `1,0000,1` |
| `CASH_REGISTER` | `1<TAB>1<TAB><TAB>0<TAB>` |

### Validation And Business Rules

| Rule | Evidence | Conclusion |
|---|---|---|
| `testSale` constructor flag changes payload | `toIntList()` never reads `testSale` | It does not affect target command payload |
| Required fields | All fields are literals | No caller-supplied field validation found |
| Uppercase / Cyrillic conversion | No conversion calls in `OpenFiscalReceipt` | None |
| Automatic truncation | No string input | None |

### Response Handling

Class/method: `FiscalReceiptPanel$PrintReceiptThread.run()`

Bytecode evidence:

```text
new OpenFiscalReceipt
invokespecial OpenFiscalReceipt.<init>()V
invokevirtual Ecr.sendReceive(AEcrCommand):EcrResponse
pop
```

Java-equivalent pseudocode:

```java
AEcrCommand open = new OpenFiscalReceipt();
Constants.ECR.sendReceive(open); // response discarded
```

Interpretation:

| Response part | Receipt workflow usage |
|---|---|
| `response.getResult()` | Not read |
| `response.getData()` | Not read |
| `response.getStatus()` | Not read |
| Success condition | UNKNOWN beyond no exception |

## REGISTER_SALE

### Class

| Field | Value |
|---|---|
| Java class | `ecr.ecrcommunication.commands.fiscalreceipt.ReceiptItem` |
| Package | `ecr.ecrcommunication.commands.fiscalreceipt` |
| Inheritance | `ReceiptItem extends AEcrCommand` |
| Interfaces | None found in class declaration |
| Constructors | `ReceiptItem()`, `ReceiptItem(String, VatGroupEnum, double, double, boolean)`, `ReceiptItem(String, VatGroupEnum, double, double, boolean, PriceCorrectionTypeEnum, double)` |
| Command enum | `CommandsEnum.REGISTER_SALE` |

Constructor bytecode evidence:

```text
METHOD <init>()V
  getstatic CommandsEnum.REGISTER_SALE
  invokespecial AEcrCommand.<init>(CommandsEnum)
  ldc ""
  putfield description
  getstatic VatGroupEnum.VAT_GROUP_A
  putfield vatGroup
  dconst_0
  putfield price
  dconst_1
  putfield quantity
  iconst_0
  putfield macedonianItem
  getstatic PriceCorrectionTypeEnum.NONE
  putfield priceCorrectionTypeEnum
  dconst_0
  putfield priceCorrectionValue
```

Java-equivalent pseudocode:

```java
public ReceiptItem() {
    super(CommandsEnum.REGISTER_SALE);
    this.description = "";
    this.vatGroup = VatGroupEnum.VAT_GROUP_A;
    this.price = 0.0;
    this.quantity = 1.0;
    this.macedonianItem = false;
    this.priceCorrectionTypeEnum = PriceCorrectionTypeEnum.NONE;
    this.priceCorrectionValue = 0.0;
}
```

### Validation

Class/method: `ReceiptItem.ValidateItem()`

Validation methods called:

```text
ValidateDescription()
ValidatePrice()
ValidateQuantity()
ValidateVatGroup()
```

Validation table:

| Field | Method | Rule | Failure |
|---|---|---|---|
| Description | `ValidateDescription()` | Must not be `null` | Throws `Exception("Description field must not be NULL")` |
| Description, printer only | `ValidateDescription()` | If `length > 20`, split/truncate to two lines | Mutates `description` |
| Price | `ValidatePrice()` | Throws only when `price < 0` | Throws `Exception("Price must be greater then 0")` |
| Quantity | `ValidateQuantity()` | Throws only when `quantity < 0` | Throws `Exception("Quantity must be greater then 0")` |
| VAT group | `ValidateVatGroup()` | Must not be `null` | Throws `Exception("Vat Group was not assigned")` |

Important boundary conclusion:

| Field | Java accepts? | Evidence |
|---|---|---|
| Price `0.00` | Yes | Validation checks `< 0`, not `<= 0` |
| Quantity `0.000` | Yes | Validation checks `< 0`, not `<= 0` |
| Negative price | No | Throws exception |
| Negative quantity | No | Throws exception |
| Null VAT group | No | Throws exception |
| Empty description | The command class accepts it | `ValidateDescription()` checks null and length only; the UI workflow separately rejects empty selected item rows |

Description bytecode evidence:

```text
if description == null:
  new Exception("Description field must not be NULL")

if Constants.deviceType == PRINTER && description.length() > 20:
  firstPart = description.substring(0, 19)
  secondPart = description.substring(19, description.length() - 1)
  if secondPart.length() > 20:
      secondPart = secondPart.substring(0, 19)
  description = firstPart + '\n' + secondPart
```

Java-equivalent pseudocode:

```java
private boolean ValidateDescription() throws Exception {
    if (description == null) {
        throw new Exception("Description field must not be NULL");
    }

    if (Constants.deviceType == DeviceTypeEnum.PRINTER && description.length() > 20) {
        String firstPart = description.substring(0, 19);
        String secondPart = description.substring(19, description.length() - 1);
        if (secondPart.length() > 20) {
            secondPart = secondPart.substring(0, 19);
        }
        description = firstPart + '\n' + secondPart;
    }

    return true;
}
```

Business rule: for printer descriptions longer than 20 Java characters, Java does not reject. It mutates the description into at most two lines. The split uses index `19`, and the second substring ends at `description.length() - 1`, so the last original character is omitted by the bytecode.

### Payload Builder: Shared Formatting

Class/method: `ReceiptItem.toIntList()`

Formatting bytecode evidence:

```text
new DecimalFormat("0.00")     // price
new DecimalFormat("0.000")    // quantity
invokestatic Utils.replaceAllDecimalSeparators(String):String
```

Shared formatting:

| Value | Format |
|---|---|
| Price | `DecimalFormat("0.00")`, then decimal separators normalized |
| Quantity | `DecimalFormat("0.000")`, then decimal separators normalized |
| Correction value | `DecimalFormat("0.00")`, then decimal separators normalized |
| Text encoding | `Utils.getIntListFromString(...)` |

Rounding:

| Value | Proven rounding behavior |
|---|---|
| Price | `DecimalFormat("0.00")` behavior |
| Quantity | `DecimalFormat("0.000")` behavior |
| Correction value | `DecimalFormat("0.00")` behavior |
| Explicit custom rounding code | None found in `ReceiptItem` |

### Payload Builder: Printer

Bytecode evidence:

```text
aload_0.description
invokestatic Utils.getIntListFromString
ldc "\t"
invokestatic Utils.getIntListFromString
if macedonianItem:
  bipush 64                  // '@'
vatGroup.getValue()
DecimalFormat("0.00").format(price)
ldc "*"
DecimalFormat("0.000").format(quantity)
if priceCorrectionTypeEnum != NONE:
  if value correction: separator ";"
  if percent correction: separator ","
  if surcharge: "+"
  if discount: "-"
  DecimalFormat("0.00").format(abs/correctionValue)
```

Printer payload field order:

| Order | Field | Separator / prefix |
|---|---|---|
| 1 | Description | raw text, possibly split with LF by validation |
| 2 | Tab | `\t` |
| 3 | Macedonian marker | `@` only when `macedonianItem == true` |
| 4 | VAT group | `vatGroup.getValue()` as one character |
| 5 | Price | formatted `0.00` |
| 6 | Quantity separator | `*` |
| 7 | Quantity | formatted `0.000` |
| 8 | Optional correction separator | `;` for value corrections, `,` for percent corrections |
| 9 | Optional correction sign | `+` for surcharge, `-` for discount |
| 10 | Optional correction value | formatted `0.00` |

Java-equivalent pseudocode:

```java
public List<Integer> toIntList() throws Exception {
    ValidateItem();

    if (Constants.deviceType == DeviceTypeEnum.PRINTER) {
        String priceString = normalize(new DecimalFormat("0.00").format(price));
        String quantityString = normalize(new DecimalFormat("0.000").format(quantity));

        List<Integer> result = new ArrayList<Integer>();
        result.addAll(Utils.getIntListFromString(description));
        result.addAll(Utils.getIntListFromString("\t"));

        if (macedonianItem) {
            result.add(64); // '@'
        }

        result.add(vatGroup.getValue());
        result.addAll(Utils.getIntListFromString(priceString));
        result.addAll(Utils.getIntListFromString("*"));
        result.addAll(Utils.getIntListFromString(quantityString));

        if (priceCorrectionTypeEnum != PriceCorrectionTypeEnum.NONE) {
            if (priceCorrectionTypeEnum == PriceCorrectionTypeEnum.DISCOUNT_VALUE ||
                priceCorrectionTypeEnum == PriceCorrectionTypeEnum.SURCHARGE_VALUE) {
                result.addAll(Utils.getIntListFromString(";"));
            } else {
                result.addAll(Utils.getIntListFromString(","));
            }

            if (priceCorrectionTypeEnum == PriceCorrectionTypeEnum.SURCHARGE_VALUE ||
                priceCorrectionTypeEnum == PriceCorrectionTypeEnum.SURCHARGE_PERCENT) {
                result.addAll(Utils.getIntListFromString("+"));
                result.addAll(Utils.getIntListFromString(format2(priceCorrectionValue)));
            } else {
                result.addAll(Utils.getIntListFromString("-"));
                result.addAll(Utils.getIntListFromString(format2(Math.abs(priceCorrectionValue))));
            }
        }

        return result;
    }

    // Cash-register branch below.
}
```

Printer examples:

| Input | Payload string meaning |
|---|---|
| Description `Milk`, VAT A, price `10`, quantity `2`, Macedonian false | `Milk<TAB><VAT_A>10.00*2.000` |
| Same with Macedonian true | `Milk<TAB>@<VAT_A>10.00*2.000` |
| Discount value `5` | `...; -5.00` without the space; actual bytes are `;`, `-`, `5.00` |
| Discount percent `10` | `...,-10.00` |
| Surcharge value `3` | `...;+3.00` |
| Surcharge percent `7` | `...,+7.00` |

The exact visible VAT characters are the integer values returned by `VatGroupEnum.getValue()`.

### Payload Builder: Cash Register

Bytecode evidence:

```text
vatGroup VAT_GROUP_A -> "1"
vatGroup VAT_GROUP_B -> "2"
vatGroup VAT_GROUP_V -> "3"
vatGroup VAT_GROUP_G -> "4"

macedonianItem true -> "1"
macedonianItem false -> "0"

description.toUpperCase()
CyrillicConverter.translateToCyrillic(...)

no correction:
  "%s\t%s\t%s\t%s\t%s\t\t\t"

with correction:
  "%s\t%s\t%s\t%s\t%s\t%s\t%s\t"
```

Cash-register VAT mapping:

| VAT enum | Payload tax group |
|---|---|
| `VAT_GROUP_A` | `1` |
| `VAT_GROUP_B` | `2` |
| `VAT_GROUP_V` | `3` |
| `VAT_GROUP_G` | `4` |

Cash-register correction type mapping:

| `PriceCorrectionTypeEnum` | Payload type |
|---|---|
| `DISCOUNT_PERCENT` | `2` |
| `SURCHARGE_PERCENT` | `1` |
| `DISCOUNT_VALUE` | `4` |
| `SURCHARGE_VALUE` | `3` |
| `NONE` | Empty correction fields |

Cash-register payload without correction:

| Order | Field |
|---|---|
| 1 | `CyrillicConverter.translateToCyrillic(description.toUpperCase())` |
| 2 | Tab |
| 3 | Tax group `1..4` |
| 4 | Tab |
| 5 | Price `0.00` |
| 6 | Tab |
| 7 | Quantity `0.000` |
| 8 | Tab |
| 9 | Macedonian flag `1` or `0` |
| 10 | Tab |
| 11 | Empty correction type |
| 12 | Tab |
| 13 | Empty correction value |
| 14 | Tab |

Cash-register payload with correction:

| Order | Field |
|---|---|
| 1 | Uppercase Cyrillic-translated description |
| 2 | Tab |
| 3 | Tax group `1..4` |
| 4 | Tab |
| 5 | Price `0.00` |
| 6 | Tab |
| 7 | Quantity `0.000` |
| 8 | Tab |
| 9 | Macedonian flag `1` or `0` |
| 10 | Tab |
| 11 | Correction type `1..4` |
| 12 | Tab |
| 13 | Correction value `0.00` |
| 14 | Tab |

Java-equivalent pseudocode:

```java
if (Constants.deviceType == DeviceTypeEnum.CASH_REGISTER) {
    String taxGroup = mapVatGroup(vatGroup);      // A=1, B=2, V=3, G=4
    String mk = macedonianItem ? "1" : "0";
    String priceString = format2(price);
    String quantityString = format3(quantity);
    String desc = CyrillicConverter.translateToCyrillic(description.toUpperCase());

    if (priceCorrectionTypeEnum == PriceCorrectionTypeEnum.NONE) {
        return Utils.getIntListFromString(
            desc + "\t" + taxGroup + "\t" + priceString + "\t" +
            quantityString + "\t" + mk + "\t\t\t"
        );
    }

    String correctionType = mapCorrectionType(priceCorrectionTypeEnum);
    String correctionValue = format2(priceCorrectionValue);
    return Utils.getIntListFromString(
        desc + "\t" + taxGroup + "\t" + priceString + "\t" +
        quantityString + "\t" + mk + "\t" + correctionType + "\t" +
        correctionValue + "\t"
    );
}
```

Cash-register examples:

| Input | Payload string meaning |
|---|---|
| Description `Milk`, VAT A, price `10`, quantity `2`, Macedonian false, no correction | `MILK translated-to-Cyrillic<TAB>1<TAB>10.00<TAB>2.000<TAB>0<TAB><TAB><TAB>` |
| Same with Macedonian true | `MILK translated-to-Cyrillic<TAB>1<TAB>10.00<TAB>2.000<TAB>1<TAB><TAB><TAB>` |
| Discount percent `10` | Correction type field `2`, correction value `10.00` |
| Surcharge value `3` | Correction type field `3`, correction value `3.00` |

### Response Handling

Class/method: `FiscalReceiptPanel$PrintReceiptThread.run()`

Bytecode evidence:

```text
new ReceiptItem
invokespecial ReceiptItem.<init>(String,VatGroupEnum,double,double,boolean,PriceCorrectionTypeEnum,double)
invokevirtual Ecr.sendReceive(AEcrCommand):EcrResponse
pop
```

Java-equivalent pseudocode:

```java
ReceiptItem item = new ReceiptItem(description, vat, price, quantity, mk, correctionType, correctionValue);
Constants.ECR.sendReceive(item); // response discarded
```

Interpretation:

| Response part | Receipt workflow usage |
|---|---|
| `response.getResult()` | Not read |
| `response.getData()` | Not read |
| `response.getStatus()` | Not read |
| Success condition | UNKNOWN beyond no exception |

## CALCULATE_TOTAL

The target workflow uses `ecr.ecrcommunication.commands.fiscalreceipt.PaymentMethod`. A second class, `ecr.ecrcommunication.commands.info.GetTotal`, also uses `CommandsEnum.CALCULATE_TOTAL`, but no receipt workflow caller for `GetTotal` was found in the whole-JAR search.

### Class: PaymentMethod

| Field | Value |
|---|---|
| Java class | `ecr.ecrcommunication.commands.fiscalreceipt.PaymentMethod` |
| Package | `ecr.ecrcommunication.commands.fiscalreceipt` |
| Inheritance | `PaymentMethod extends AEcrCommand` |
| Interfaces | None found in class declaration |
| Constructors | `PaymentMethod()`, `PaymentMethod(PaymentMethodEnum, double)`, `PaymentMethod(PaymentMethodEnum)` |
| Command enum | `CommandsEnum.CALCULATE_TOTAL` |

Constructor bytecode evidence:

```text
METHOD <init>()V
  getstatic CommandsEnum.CALCULATE_TOTAL
  invokespecial AEcrCommand.<init>(CommandsEnum)
  aconst_null
  putfield infoLine1
  aconst_null
  putfield infoLine2
  getstatic PaymentMethodEnum.CASH
  putfield paymentMethod
  dconst_0
  putfield value
```

Java-equivalent pseudocode:

```java
public PaymentMethod() {
    super(CommandsEnum.CALCULATE_TOTAL);
    this.infoLine1 = null;
    this.infoLine2 = null;
    this.paymentMethod = PaymentMethodEnum.CASH;
    this.value = 0.0;
}
```

Payment enum values:

| Enum | Printer payload char |
|---|---|
| `CASH` | `P` |
| `CREDIT` | `N` |
| `CHECK` | `C` |
| `DEBIT` | `D` |

### Payload Builder: Printer

Class/method: `PaymentMethod.toIntList()`

Bytecode evidence:

```text
new DecimalFormat("0.00")
new ArrayList
if infoLine1 != null && infoLine1.trim() != "":
  add infoLine1.trim()
if infoLine2 != null && infoLine2.trim() != "":
  add LF
  add infoLine2.trim()
add TAB
if paymentMethod != null && value > 0:
  add paymentMethod.GetValue()
  add DecimalFormat("0.00").format(value)
if paymentMethod == null:
  add TAB
```

Printer payload field order:

| Order | Field |
|---|---|
| 1 | Optional `infoLine1.trim()` |
| 2 | Optional LF byte `10` before line 2 |
| 3 | Optional `infoLine2.trim()` |
| 4 | Tab byte `9` |
| 5 | Optional payment method char, only if `paymentMethod != null && value > 0` |
| 6 | Optional amount formatted `0.00`, only if `paymentMethod != null && value > 0` |
| 7 | Extra tab only if `paymentMethod == null` |

Java-equivalent pseudocode:

```java
public List<Integer> toIntList() {
    DecimalFormat df = new DecimalFormat("0.00");
    List<Integer> result = new ArrayList<Integer>();

    if (infoLine1 != null && !infoLine1.trim().equals("")) {
        result.addAll(Utils.getIntListFromString(infoLine1.trim()));
    }

    if (infoLine2 != null && !infoLine2.trim().equals("")) {
        result.add(10); // LF
        result.addAll(Utils.getIntListFromString(infoLine2.trim()));
    }

    result.add(9); // TAB

    if (paymentMethod != null && value > 0) {
        result.add(paymentMethod.GetValue());
        result.addAll(Utils.getIntListFromString(normalize(df.format(value))));
    }

    if (paymentMethod == null) {
        result.add(9); // TAB
    }

    return result;
}
```

Printer examples:

| Object state | Payload meaning |
|---|---|
| Default constructor | `<TAB>` |
| `CASH`, value `0` | `<TAB>` |
| `CASH`, value `100` | `<TAB>P100.00` |
| `CREDIT`, value `50.5` | `<TAB>N50.50` |
| `paymentMethod == null` | `<TAB><TAB>` |
| `infoLine1="A"`, `infoLine2="B"`, `CASH`, value `10` | `A<LF>B<TAB>P10.00` |

### Payload Builder: Cash Register

Bytecode evidence:

```text
type default "0"
if paymentMethod == DEBIT: type = "1"
if paymentMethod == CREDIT: type = "2"
amount default ""
if value > 0: amount = DecimalFormat("0.00").format(value)
payload = type + "\t" + amount + "\t"
```

Cash-register payment type mapping:

| Payment method | Payload type |
|---|---|
| `CASH` | `0` |
| `CHECK` | `0` |
| `DEBIT` | `1` |
| `CREDIT` | `2` |
| `null` | `0` by default path |

Cash-register payload fields:

| Order | Field |
|---|---|
| 1 | Payment type `0`, `1`, or `2` |
| 2 | Tab |
| 3 | Amount, empty unless `value > 0` |
| 4 | Tab |

Java-equivalent pseudocode:

```java
if (Constants.deviceType == DeviceTypeEnum.CASH_REGISTER) {
    String type = "0";
    if (paymentMethod == PaymentMethodEnum.DEBIT) {
        type = "1";
    } else if (paymentMethod == PaymentMethodEnum.CREDIT) {
        type = "2";
    }

    String amount = "";
    if (value > 0) {
        amount = normalize(new DecimalFormat("0.00").format(value));
    }

    return Utils.getIntListFromString(type + "\t" + amount + "\t");
}
```

Cash-register examples:

| Object state | Payload string |
|---|---|
| Default constructor | `0<TAB><TAB>` |
| `CASH`, value `100` | `0<TAB>100.00<TAB>` |
| `CHECK`, value `100` | `0<TAB>100.00<TAB>` |
| `DEBIT`, value `100` | `1<TAB>100.00<TAB>` |
| `CREDIT`, value `100` | `2<TAB>100.00<TAB>` |

### Validation And Business Rules

| Rule | Evidence | Conclusion |
|---|---|---|
| Required payment method | No validation method found | `paymentMethod` may be null; printer emits extra tab, cash-register uses type `0` |
| Required amount | No validation method found | `value <= 0` produces no amount in printer branch and empty amount in cash-register branch |
| Negative amount | No explicit rejection found | Negative values behave like `value <= 0`; no amount is emitted |
| Decimal formatting | `DecimalFormat("0.00")` | Values are formatted to two decimals when emitted |
| Info line max length | No max validation found | UNKNOWN |
| Info line encoding | `Utils.getIntListFromString(...)` | Same text encoding helper |

### Alternate Class: GetTotal

| Field | Value |
|---|---|
| Java class | `ecr.ecrcommunication.commands.info.GetTotal` |
| Package | `ecr.ecrcommunication.commands.info` |
| Inheritance | `GetTotal extends AEcrCommand` |
| Interfaces | None found in class declaration |
| Constructor | `GetTotal(PaymentMethodEnum paymentMethodInUse, double value)` |
| Command enum | `CommandsEnum.CALCULATE_TOTAL` |
| Workflow usage | No receipt workflow caller found |

Bytecode evidence:

```text
new ArrayList
new DecimalFormat("0.00")
add TAB
if paymentMethodInUse != null && value > 0:
  add paymentMethodInUse.GetValue()
  add DecimalFormat("0.00").format(value)
```

Java-equivalent pseudocode:

```java
public List<Integer> toIntList() {
    List<Integer> result = new ArrayList<Integer>();
    result.add(9); // TAB
    if (paymentMethodInUse != null && value > 0) {
        result.add(paymentMethodInUse.GetValue());
        result.addAll(Utils.getIntListFromString(format2(value)));
    }
    return result;
}
```

Conclusion: `GetTotal` constructs a `CALCULATE_TOTAL` payload similar to the printer payment part, but the searched receipt workflows use `PaymentMethod`, not `GetTotal`.

### Response Handling

Class/method: `FiscalReceiptPanel$PrintReceiptThread.run()`

Bytecode evidence:

```text
new PaymentMethod
invokevirtual PaymentMethod.setPaymentMethod(PaymentMethodEnum)
invokevirtual PaymentMethod.setValue(D)
invokevirtual Ecr.sendReceive(AEcrCommand):EcrResponse
pop
```

Java-equivalent pseudocode:

```java
PaymentMethod payment = new PaymentMethod();
payment.setPaymentMethod(method);
payment.setValue(amount);
Constants.ECR.sendReceive(payment); // response discarded
```

Interpretation:

| Response part | Receipt workflow usage |
|---|---|
| `response.getResult()` | Not read |
| `response.getData()` | Not read |
| `response.getStatus()` | Not read |
| Success condition | UNKNOWN beyond no exception |

## CLOSE_FISCAL_RECEIPT

### Class

| Field | Value |
|---|---|
| Java class | `ecr.ecrcommunication.commands.fiscalreceipt.CloseFiscalReceipt` |
| Package | `ecr.ecrcommunication.commands.fiscalreceipt` |
| Inheritance | `CloseFiscalReceipt extends AEcrCommand` |
| Interfaces | None found in class declaration |
| Constructor | `CloseFiscalReceipt()` |
| Command enum | `CommandsEnum.CLOSE_FISCAL_RECEIPT` |

Bytecode evidence:

```text
METHOD <init>()V
  getstatic CommandsEnum.CLOSE_FISCAL_RECEIPT
  invokespecial AEcrCommand.<init>(CommandsEnum)

METHOD toIntList()Ljava/util/List;
  aconst_null
  areturn
```

Java-equivalent pseudocode:

```java
public class CloseFiscalReceipt extends AEcrCommand {
    public CloseFiscalReceipt() {
        super(CommandsEnum.CLOSE_FISCAL_RECEIPT);
    }

    public List<Integer> toIntList() {
        return null;
    }
}
```

Payload:

| Field | Value |
|---|---|
| Payload list | `null` |
| Separators | None |
| Encoding | None |
| Validation | None found |

Response handling:

```java
Constants.ECR.sendReceive(new CloseFiscalReceipt()); // response discarded
```

| Response part | Receipt workflow usage |
|---|---|
| `response.getResult()` | Not read |
| `response.getData()` | Not read |
| `response.getStatus()` | Not read |
| Success condition | UNKNOWN beyond no exception |

## CANCEL_FISCAL_RECEIPT

### Class

| Field | Value |
|---|---|
| Java class | `ecr.ecrcommunication.commands.fiscalreceipt.CancelFiscalReceipt` |
| Package | `ecr.ecrcommunication.commands.fiscalreceipt` |
| Inheritance | `CancelFiscalReceipt extends AEcrCommand` |
| Interfaces | None found in class declaration |
| Constructor | `CancelFiscalReceipt()` |
| Command enum | `CommandsEnum.CANCEL_FISCAL_RECEIPT` |

Bytecode evidence:

```text
METHOD <init>()V
  getstatic CommandsEnum.CANCEL_FISCAL_RECEIPT
  invokespecial AEcrCommand.<init>(CommandsEnum)

METHOD toIntList()Ljava/util/List;
  aconst_null
  areturn
```

Java-equivalent pseudocode:

```java
public class CancelFiscalReceipt extends AEcrCommand {
    public CancelFiscalReceipt() {
        super(CommandsEnum.CANCEL_FISCAL_RECEIPT);
    }

    public List<Integer> toIntList() {
        return null;
    }
}
```

Payload:

| Field | Value |
|---|---|
| Payload list | `null` |
| Separators | None |
| Encoding | None |
| Validation | None found |

Workflow usage:

| Class/method | Usage |
|---|---|
| `FiscalReceiptPanel$PrintReceiptThread.run()` | No `CancelFiscalReceipt` usage found |
| `PrintFiscalReceiptThread.run()` | Sends `CancelFiscalReceipt` during startup cleanup before opening a demo receipt |
| `PrintFiscalReceiptsThread.run()` | Sends `CancelFiscalReceipt` during each loop startup cleanup before opening a test receipt |

Bytecode evidence from `PrintFiscalReceiptThread.run()`:

```text
new PaymentMethod(CASH)
sendReceive
new CloseFiscalReceipt
sendReceive
new CloseVoidReceipt
sendReceive
new CancelFiscalReceipt
sendReceive
```

Java-equivalent pseudocode:

```java
// Demo/test cleanup, before opening a new demo receipt:
Constants.ECR.sendReceive(new PaymentMethod(PaymentMethodEnum.CASH));
Constants.ECR.sendReceive(new CloseFiscalReceipt());
Constants.ECR.sendReceive(new CloseVoidReceipt());
Constants.ECR.sendReceive(new CancelFiscalReceipt());
```

Response handling:

| Response part | Demo/test cleanup usage |
|---|---|
| `response.getResult()` | Not read |
| `response.getData()` | Not read |
| `response.getStatus()` | Not read |
| Success condition | UNKNOWN beyond no exception |

## Main Fiscal Receipt Workflow

Class: `ecr.ui.panels.FiscalReceiptPanel$PrintReceiptThread`

Method: `run()`

Constructor:

| Constructor | Meaning |
|---|---|
| `FiscalReceiptPanel$PrintReceiptThread(FiscalReceiptPanel parent, boolean isCanceled)` | Stores the parent panel and whether the receipt should be a void receipt flow |

Workflow bytecode evidence:

```text
new OpenFiscalReceipt / new OpenVoidReceipt
Ecr.sendReceive
new ReceiptItem(...)
Ecr.sendReceive
new PaymentMethod()
setPaymentMethod(...)
setValue(...)
Ecr.sendReceive
new CloseFiscalReceipt / new CloseVoidReceipt
Ecr.sendReceive
```

Java-equivalent high-level pseudocode:

```java
public void run() {
    try {
        disableFields();

        read up to 8 selected UI item rows;
        validate selected row description, price, quantity, correction values;

        if (no rows selected) {
            show message;
            enableFields();
            return;
        }

        if (any row parse/description error) {
            show error;
            enableFields();
            return;
        }

        AEcrCommand open = isCanceled ? new OpenVoidReceipt() : new OpenFiscalReceipt();
        Constants.ECR.sendReceive(open);

        for each selected row in UI order 1..8:
            Constants.ECR.sendReceive(new ReceiptItem(
                description.trim(),
                vatGroup,
                price,
                quantity,
                macedonianFlag,
                priceCorrectionType,
                priceCorrectionValue
            ));

        send payments;

        AEcrCommand close = isCanceled ? new CloseVoidReceipt() : new CloseFiscalReceipt();
        Constants.ECR.sendReceive(close);

        enableFields();
    } catch (Exception e) {
        log error;
        show e.getMessage();
        enableFields();
    }
}
```

### Item Row Handling

Class/method: `FiscalReceiptPanel$PrintReceiptThread.run()`

Bytecode evidence:

```text
use1..use8 booleans read from JCheckBox.isSelected()
description text read from JTextField.getText()
Double.parseDouble(text.trim()) for price and quantity
JComboBox.getSelectedIndex() maps VAT group
JComboBox.getSelectedItem() maps PriceCorrectionTypeEnum
Double.parseDouble(...) for correction value when non-empty
```

UI row limits:

| Rule | Evidence | Conclusion |
|---|---|---|
| Number of UI item rows | Locals and unrolled bytecode for `use1` through `use8` | The UI workflow supports up to 8 selected rows |
| Command class item limit | `ReceiptItem` has no global count check | UNKNOWN/unlimited at command-class level |
| Selected row empty description | UI sets row error | Main UI rejects selected rows with empty description before opening receipt |
| Selected row price parse failure | UI sets row error | Main UI rejects before opening receipt |
| Selected row quantity parse failure | UI sets row error | Main UI rejects before opening receipt |
| Correction value parse failure | UI sets row error | Main UI rejects before opening receipt |

VAT selection mapping in the UI:

| Selected index | VAT group |
|---|---|
| Default / `0` | `VAT_GROUP_A` |
| `1` | `VAT_GROUP_B` |
| `2` | `VAT_GROUP_V` |
| `3` | `VAT_GROUP_G` |

Item send order:

```java
if (use1) send row 1;
if (use2) send row 2;
if (use3) send row 3;
if (use4) send row 4;
if (use5) send row 5;
if (use6) send row 6;
if (use7) send row 7;
if (use8) send row 8;
```

### Payment Handling

Class/method: `FiscalReceiptPanel$PrintReceiptThread.run()`

Bytecode evidence:

```text
Double.parseDouble(paymentCashText.trim()) catch NumberFormatException -> keep 0
Double.parseDouble(paymentCreditText.trim()) catch NumberFormatException -> keep 0
Double.parseDouble(paymentCheckText.trim()) catch NumberFormatException -> keep 0
Double.parseDouble(paymentDebitText.trim()) catch NumberFormatException -> keep 0

if paymentCash + paymentCredit + paymentCheck + paymentDebit == 0:
  new PaymentMethod()
  setPaymentMethod(CASH)
  sendReceive
else:
  if paymentCash > 0: send CASH value
  if paymentCredit > 0: send CREDIT value
  if paymentCheck > 0: send CHECK value
  if paymentDebit > 0: send DEBIT value
```

Java-equivalent pseudocode:

```java
double cash = parseOrZero(cashField);
double credit = parseOrZero(creditField);
double check = parseOrZero(checkField);
double debit = parseOrZero(debitField);

if (cash + credit + check + debit == 0.0) {
    PaymentMethod pm = new PaymentMethod();
    pm.setPaymentMethod(PaymentMethodEnum.CASH);
    Constants.ECR.sendReceive(pm);
} else {
    if (cash > 0) {
        PaymentMethod pm = new PaymentMethod();
        pm.setPaymentMethod(PaymentMethodEnum.CASH);
        pm.setValue(cash);
        Constants.ECR.sendReceive(pm);
    }
    if (credit > 0) {
        PaymentMethod pm = new PaymentMethod();
        pm.setPaymentMethod(PaymentMethodEnum.CREDIT);
        pm.setValue(credit);
        Constants.ECR.sendReceive(pm);
    }
    if (check > 0) {
        PaymentMethod pm = new PaymentMethod();
        pm.setPaymentMethod(PaymentMethodEnum.CHECK);
        pm.setValue(check);
        Constants.ECR.sendReceive(pm);
    }
    if (debit > 0) {
        PaymentMethod pm = new PaymentMethod();
        pm.setPaymentMethod(PaymentMethodEnum.DEBIT);
        pm.setValue(debit);
        Constants.ECR.sendReceive(pm);
    }
}
```

Multiple payment conclusion:

| Question | Answer |
|---|---|
| Can Java call `CALCULATE_TOTAL` more than once? | Yes |
| How? | The UI sends one `PaymentMethod` command for each positive payment amount |
| Order | Cash, credit, check, debit |
| What if all payment fields are zero or invalid? | Sends one cash `PaymentMethod` with value `0`, which emits no amount in the command payload |
| Does Java check whether payment amounts equal the receipt total? | No explicit check found in this workflow |

### Exact Normal Receipt Flow

Class/method: `FiscalReceiptPanel$PrintReceiptThread.run()`

Java-equivalent pseudocode:

```java
Constants.ECR.sendReceive(new OpenFiscalReceipt());

Constants.ECR.sendReceive(new ReceiptItem(row1...)); // for each selected row
Constants.ECR.sendReceive(new ReceiptItem(row2...));
// ...

Constants.ECR.sendReceive(payment1);
Constants.ECR.sendReceive(payment2);
// ...

Constants.ECR.sendReceive(new CloseFiscalReceipt());
```

Example normal receipt:

```text
OpenFiscalReceipt
Register row 1 item
Register row 2 item
PaymentMethod CASH 100.00
PaymentMethod CREDIT 50.00
CloseFiscalReceipt
```

This is exactly how the main Java UI workflow performs a normal fiscal receipt when two rows and two payment amounts are selected.

### Exact Void Receipt Flow

Class/method: `FiscalReceiptPanel$PrintReceiptThread.run()`

Evidence:

```text
if isCanceled:
  new OpenVoidReceipt
else:
  new OpenFiscalReceipt
...
if isCanceled:
  new CloseVoidReceipt
else:
  new CloseFiscalReceipt
```

Java-equivalent pseudocode:

```java
Constants.ECR.sendReceive(new OpenVoidReceipt());
send same ReceiptItem commands;
send same PaymentMethod commands;
Constants.ECR.sendReceive(new CloseVoidReceipt());
```

Conclusion: Java's main UI uses the same item and payment commands for void receipts, but uses void open/close commands instead of normal fiscal open/close commands.

## Recovery Behavior

### Main UI Receipt Worker

Class/method: `FiscalReceiptPanel$PrintReceiptThread.run()`

Exception bytecode evidence:

```text
2040..2790 -> 2793 type Exception
2793: astore ...
2797: athrow

0..2823 -> 2832 type Exception
2832: astore e
Constants.APPLICATION_LOGGER.error(e)
JOptionPane.showMessageDialog(..., e.getMessage(), ...)
enableFields()
```

Java-equivalent pseudocode:

```java
try {
    try {
        open receipt;
        register items;
        calculate total / payments;
        close receipt;
    } catch (Exception e) {
        throw e;
    }
} catch (Exception e) {
    Constants.APPLICATION_LOGGER.error(e);
    JOptionPane.showMessageDialog(..., e.getMessage(), ...);
    enableFields();
}
```

Recovery table:

| Failure point | Main UI behavior |
|---|---|
| Validation before open fails | Shows error/message, does not open receipt |
| `OPEN_FISCAL_RECEIPT` throws | Logs, shows dialog, enables fields |
| `REGISTER_SALE` throws | Logs, shows dialog, enables fields |
| `CALCULATE_TOTAL` throws | Logs, shows dialog, enables fields |
| `CLOSE_FISCAL_RECEIPT` throws | Logs, shows dialog, enables fields |
| Command returns non-OK but no exception | UNKNOWN; main UI does not inspect returned `EcrResponse` |
| Automatic `CANCEL_FISCAL_RECEIPT` after failure | No evidence in main UI worker |
| Automatic retry | No evidence |
| Automatic reopen | No evidence |

Direct answers:

| Question | Answer |
|---|---|
| If `REGISTER_SALE` fails, what happens? | If failure is an exception, it is logged and shown to the user. No automatic cancel/retry/reopen found. If failure is only in `EcrResponse`, UNKNOWN because response is discarded. |
| If `CALCULATE_TOTAL` fails, what happens? | Same: exception is logged and shown; no automatic cancel/retry/reopen found. |
| If `CLOSE_FISCAL_RECEIPT` fails, what happens? | Same: exception is logged and shown; no automatic cancel/retry/reopen found. |
| Does Java automatically call `CANCEL_FISCAL_RECEIPT` in main receipt workflow? | No evidence found. |
| Does Java retry? | No evidence found. |
| Does Java reopen? | No evidence found. |
| Does Java throw exception? | The workflow catches `Exception`; command validation and `sendReceive(...)` can throw. The inner catch rethrows to the outer UI catch. |

### Demo/Test Cleanup Is Not Main Recovery

Class: `ecr.threads.PrintFiscalReceiptThread`

Method: `run()`

Bytecode evidence:

```text
line 35: send PaymentMethod(CASH)
line 36: send CloseFiscalReceipt
line 37: send CloseVoidReceipt
line 38: send CancelFiscalReceipt
line 41/46: open normal or void receipt
```

Class: `ecr.threads.PrintFiscalReceiptsThread`

Method: `run()`

Evidence: same cleanup pattern appears at the start of each test/stress iteration.

Java-equivalent pseudocode:

```java
// Test/demo startup cleanup:
send PaymentMethod(CASH);
send CloseFiscalReceipt;
send CloseVoidReceipt;
send CancelFiscalReceipt;

// Then open and print a hardcoded test receipt.
```

Conclusion: `CancelFiscalReceipt` appears in demo/test pre-cleanup. It was not found as automatic recovery after a failed main UI receipt command.

## Multiple Items

Class/method: `FiscalReceiptPanel$PrintReceiptThread.run()`

Evidence:

```text
use1..use8
if use1: new ReceiptItem(... row 1 ...)
if use2: new ReceiptItem(... row 2 ...)
...
if use8: new ReceiptItem(... row 8 ...)
```

Table:

| Question | Answer |
|---|---|
| Can Java call `REGISTER_SALE` more than once? | Yes |
| How? | It sends one `ReceiptItem` per selected UI row |
| Main UI max | 8 rows |
| Command-class max | UNKNOWN; no item count limit found in `ReceiptItem` |
| Order | Row order 1 through 8 |
| Does it stop on non-exception response? | UNKNOWN; response is discarded |
| Does it stop on exception? | Yes, exception exits the workflow catch path |

## Receipt Types

### Normal Fiscal Receipt

Class/method: `FiscalReceiptPanel$PrintReceiptThread.run()`

Flow:

```text
OpenFiscalReceipt
ReceiptItem x N
PaymentMethod x 1..4
CloseFiscalReceipt
```

Proven by bytecode:

```text
new OpenFiscalReceipt
new ReceiptItem
new PaymentMethod
new CloseFiscalReceipt
```

### Void Receipt

Class/method: `FiscalReceiptPanel$PrintReceiptThread.run()`

Flow:

```text
OpenVoidReceipt
ReceiptItem x N
PaymentMethod x 1..4
CloseVoidReceipt
```

Proven by bytecode:

```text
if isCanceled:
  new OpenVoidReceipt
...
if isCanceled:
  new CloseVoidReceipt
```

Observed relation to target commands:

| Receipt kind | Open command | Item command | Payment command | Close command |
|---|---|---|---|---|
| Normal fiscal | `OpenFiscalReceipt` | `ReceiptItem` | `PaymentMethod` | `CloseFiscalReceipt` |
| Void | `OpenVoidReceipt` | `ReceiptItem` | `PaymentMethod` | `CloseVoidReceipt` |

### Non-Fiscal Receipt

Whole-JAR receipt workflow evidence for non-fiscal receipt printing in the target command flow: UNKNOWN.

### Training Receipt

Whole-JAR receipt workflow evidence for training receipt printing in the target command flow: UNKNOWN.

### Test Receipt

Evidence:

| Class | Behavior |
|---|---|
| `OpenFiscalReceipt(boolean testSale)` | Stores `testSale`, but `OpenFiscalReceipt.toIntList()` does not read it |
| `PrintFiscalReceiptThread` | Demo/test thread prints hardcoded receipt data |
| `PrintFiscalReceiptsThread` | Test/stress loop prints hardcoded receipt data |

Conclusion: hardcoded demo/test printing threads exist. A `testSale` flag exists in `OpenFiscalReceipt`, but no payload effect was found. A separate training/test receipt protocol difference is UNKNOWN.

### Duplicate Receipt

Whole-JAR search found `PrintDuplicateFiscalReceipt` and `CommandsEnum.PRINT_DUPLICATE`, but duplicate printing is separate from the target five-command receipt workflow. No duplicate behavior is part of the main `OpenFiscalReceipt -> ReceiptItem -> PaymentMethod -> CloseFiscalReceipt` path.

## Full Main UI Example

Class/method: `FiscalReceiptPanel$PrintReceiptThread.run()`

Example inputs:

| UI field | Value |
|---|---|
| Row 1 selected | Yes |
| Row 1 description | `Milk` |
| Row 1 VAT | A |
| Row 1 price | `10` |
| Row 1 quantity | `2` |
| Row 1 Macedonian flag | false |
| Row 1 correction | none |
| Row 2 selected | Yes |
| Row 2 description | `Bread` |
| Row 2 VAT | B |
| Row 2 price | `5` |
| Row 2 quantity | `1` |
| Cash payment | `20` |
| Credit payment | `0` |
| Check payment | `0` |
| Debit payment | `0` |

Java-equivalent command sequence:

```java
sendReceive(new OpenFiscalReceipt());

sendReceive(new ReceiptItem(
    "Milk", VAT_GROUP_A, 10.0, 2.0, false,
    PriceCorrectionTypeEnum.NONE, 0.0
));

sendReceive(new ReceiptItem(
    "Bread", VAT_GROUP_B, 5.0, 1.0, false,
    PriceCorrectionTypeEnum.NONE, 0.0
));

PaymentMethod cash = new PaymentMethod();
cash.setPaymentMethod(PaymentMethodEnum.CASH);
cash.setValue(20.0);
sendReceive(cash);

sendReceive(new CloseFiscalReceipt());
```

Printer payload examples for the same command objects:

| Command | Payload meaning |
|---|---|
| `OpenFiscalReceipt` | `1,0000,1` |
| Row 1 `ReceiptItem` | `Milk<TAB><VAT_A>10.00*2.000` |
| Row 2 `ReceiptItem` | `Bread<TAB><VAT_B>5.00*1.000` |
| Cash `PaymentMethod` | `<TAB>P20.00` |
| `CloseFiscalReceipt` | `null` payload |

Cash-register payload examples for the same command objects:

| Command | Payload meaning |
|---|---|
| `OpenFiscalReceipt` | `1<TAB>1<TAB><TAB>0<TAB>` |
| Row 1 `ReceiptItem` | `MILK translated-to-Cyrillic<TAB>1<TAB>10.00<TAB>2.000<TAB>0<TAB><TAB><TAB>` |
| Row 2 `ReceiptItem` | `BREAD translated-to-Cyrillic<TAB>2<TAB>5.00<TAB>1.000<TAB>0<TAB><TAB><TAB>` |
| Cash `PaymentMethod` | `0<TAB>20.00<TAB>` |
| `CloseFiscalReceipt` | `null` payload |

## Unknowns

The following were not proven by the searched bytecode and must remain `UNKNOWN`:

| Topic | Status |
|---|---|
| Device-side maximum number of receipt items | UNKNOWN |
| Device-side maximum payment count | UNKNOWN |
| Device-side maximum description byte length after encoding | UNKNOWN |
| Maximum allowed price | UNKNOWN |
| Maximum allowed quantity | UNKNOWN |
| Maximum allowed payment amount | UNKNOWN |
| Whether returned non-OK `EcrResponse` values throw before returning | UNKNOWN in this document because shared serial response internals are out of scope |
| Target command `response.getData()` meaning | UNKNOWN; target receipt workflow does not read it |
| Target command `response.getStatus()` meaning | UNKNOWN; target receipt workflow does not read it |
| Non-fiscal receipt command flow | UNKNOWN |
| Training receipt command flow | UNKNOWN |
| Test sale protocol difference | UNKNOWN; `testSale` flag is stored but unused by `OpenFiscalReceipt.toIntList()` |
| Automatic cancel after failed main UI item/payment/close | No evidence found |
| Automatic retry/reopen after failed main UI item/payment/close | No evidence found |

