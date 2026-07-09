# Command Payload Analysis

Scope: this document analyzes concrete command payload construction in the existing `Ecr-1.7.739.jar`, using `protocol-analysis.md` for command IDs and packet context. It does not generate .NET code, does not create a new app, and does not use `ecr.dll` or `ecrprint.exe`.

The payload analyzed here is the byte list returned by each command class `toIntList()` before `EcrSerialPort.packageCommand(AEcrCommand, boolean)` wraps it in the request frame.

## Shared Payload Rules

Class/method: `ecr.utils.Utils.getIntListFromString(String)`

Text payload strings are encoded with `cp1251`. Each byte is masked with `0xFF` before being added to the integer list.

```text
8: aload_0
9: ldc #4 "cp1251"
11: invokevirtual java/lang/String.getBytes:(Ljava/lang/String;)[B
...
37: aload_1
38: iload 6
40: sipush 255
43: iand
44: invokestatic java/lang/Integer.valueOf:(I)Ljava/lang/Integer;
```

Class/method: `ecr.utils.Utils.replaceAllDecimalSeparators(String)`

Decimal strings are normalized by replacing comma with dot.

```text
0: aload_0
1: ldc #140 ","
3: ldc #141 "."
5: invokevirtual java/lang/String.replaceAll:(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;
```

Class/method: `ecr.ecrcommunication.core.AEcrCommand`

All command classes below pass a `CommandsEnum` value into the `AEcrCommand` constructor. Response parsing is not overridden in the target command classes found below; the visible parsing remains the shared `EcrSerialPort.readFromSerialPort(AEcrCommand)` / `EcrResponse` path documented in `serial-analysis.md` and `protocol-analysis.md`.

## Fiscal Receipt Commands First

### OpenFiscalReceipt

- Java class: `ecr.ecrcommunication.commands.fiscalreceipt.OpenFiscalReceipt`
- Package path: `ecr/ecrcommunication/commands/fiscalreceipt/OpenFiscalReceipt.class`
- Constructors:
  - `OpenFiscalReceipt()`
  - `OpenFiscalReceipt(boolean testSale)`
- CommandsEnum: `OPEN_FISCAL_RECEIPT`
- Command ID: decimal `48`, hex `0x30`
- Response parsing method: no command-specific response parser found.

Class/method: `OpenFiscalReceipt.<init>()` and `OpenFiscalReceipt.<init>(boolean)`

Both constructors call `AEcrCommand.<init>(CommandsEnum.OPEN_FISCAL_RECEIPT)`. The boolean constructor stores `testSale`, but `toIntList()` does not reference the field in visible bytecode.

Payload format:

- If `Constants.deviceType == DeviceTypeEnum.PRINTER`: string `1,0000,1`
- If `Constants.deviceType == DeviceTypeEnum.CASH_REGISTER`: string `1\t1\t\t0\t`
- Encoding: `Utils.getIntListFromString(...)`, therefore `cp1251`
- Separators: comma for printer; tab for cash register.

Decompiled-equivalent snippet:

```java
if (Constants.deviceType == DeviceTypeEnum.PRINTER) {
    return Utils.getIntListFromString("1,0000,1");
}
if (Constants.deviceType == DeviceTypeEnum.CASH_REGISTER) {
    return Utils.getIntListFromString("1\t1\t\t0\t");
}
```

Example payload:

```text
PRINTER:       "1,0000,1"
CASH_REGISTER:"1<TAB>1<TAB><TAB>0<TAB>"
```

### RegisterSale

- Java class: `ecr.ecrcommunication.commands.fiscalreceipt.ReceiptItem`
- Package path: `ecr/ecrcommunication/commands/fiscalreceipt/ReceiptItem.class`
- Constructors:
  - `ReceiptItem()`
  - `ReceiptItem(String description, VatGroupEnum vatGroup, double price, double quantity, boolean macedonianItem)`
  - `ReceiptItem(String description, VatGroupEnum vatGroup, double price, double quantity, boolean macedonianItem, PriceCorrectionTypeEnum priceCorrectionTypeEnum, double priceCorrectionValue)`
- CommandsEnum: `REGISTER_SALE`
- Command ID: decimal `49`, hex `0x31`
- Response parsing method: no command-specific response parser found.

Class/method: `ReceiptItem.<init>()`

Default fields:

- `description = ""`
- `vatGroup = VAT_GROUP_A`
- `price = 0`
- `quantity = 1`
- `macedonianItem = false`
- `priceCorrectionTypeEnum = NONE`
- `priceCorrectionValue = 0`

Class/method: `ReceiptItem.toIntList()`

Validation is executed first:

```text
2: aload_0
3: invokespecial ReceiptItem.ValidateItem:()Z
6: ifeq 824
```

Validation methods:

- `ReceiptItem.ValidateDescription()` throws if `description == null`.
- For printer devices only, descriptions longer than 20 chars are split/truncated into two lines: first `substring(0, 19)`, newline char `10`, then second part from `substring(19, length - 1)`, truncated to 19 chars if needed.
- `ReceiptItem.ValidatePrice()` throws if `price < 0`.
- `ReceiptItem.ValidateQuantity()` throws if `quantity < 0`.
- `ReceiptItem.ValidateVatGroup()` throws if `vatGroup == null`.

Printer payload format:

```text
<description><TAB>[@ optional]<vatGroupChar><price 0.00>*<quantity 0.000>[correction]
```

Printer field order:

1. `description`, encoded via `Utils.getIntListFromString(description)`
2. tab `\t`
3. optional `@` if `macedonianItem == true`
4. VAT group character from `VatGroupEnum.getValue()`
5. price formatted with `DecimalFormat("0.00")`, then `Utils.replaceAllDecimalSeparators`
6. literal `*`
7. quantity formatted with `DecimalFormat("0.000")`, then `Utils.replaceAllDecimalSeparators`
8. optional correction:
   - `;` for `DISCOUNT_VALUE` or `SURCHARGE_VALUE`
   - `,` for percent correction types
   - `+` for `SURCHARGE_PERCENT` or `SURCHARGE_VALUE`
   - `-` for discount types
   - correction value formatted with `DecimalFormat("0.00")`; discount uses `Math.abs(...)`

Printer bytecode snippets:

```text
52: aload_0
53: getfield ReceiptItem.description
56: invokestatic Utils.getIntListFromString
...
60: ldc #40 "\t"
...
64: aload_0
65: getfield ReceiptItem.macedonianItem:Z
68: ifeq 93
83: bipush 64
85: invokevirtual StringBuilder.append:(C)Ljava/lang/StringBuilder;   // '@'
...
105: aload_0
106: getfield ReceiptItem.vatGroup
109: invokevirtual VatGroupEnum.getValue:()C
...
132: aload_2
133: aload_0
134: getfield ReceiptItem.price:D
137: invokevirtual DecimalFormat.format:(D)Ljava/lang/String;
140: invokestatic Utils.replaceAllDecimalSeparators
...
163: ldc #44 "*"
...
185: aload_3
186: aload_0
187: getfield ReceiptItem.quantity:D
190: invokevirtual DecimalFormat.format:(D)Ljava/lang/String;
193: invokestatic Utils.replaceAllDecimalSeparators
```

Cash-register payload format:

```text
<DESCRIPTION_UPPER_CYRILLIC><TAB><taxGroupNumber><TAB><price 0.00><TAB><quantity 0.000><TAB><macedonianFlag><TAB><correctionType><TAB><correctionValue 0.00><TAB>
```

When there is no correction, the last three fields are empty tab-separated fields:

```text
<DESCRIPTION_UPPER_CYRILLIC><TAB><taxGroupNumber><TAB><price><TAB><quantity><TAB><macedonianFlag><TAB><TAB><TAB>
```

Cash-register field order:

1. `description.toUpperCase()`, then `CyrillicConverter.translateToCyrillic(...)`
2. tab
3. tax group number:
   - `VAT_GROUP_A` -> `"1"`
   - `VAT_GROUP_B` -> `"2"`
   - `VAT_GROUP_V` -> `"3"`
   - `VAT_GROUP_G` -> `"4"`
4. tab
5. price formatted with `DecimalFormat("0.00")`, decimal comma replaced by dot
6. tab
7. quantity formatted with `DecimalFormat("0.000")`, decimal comma replaced by dot
8. tab
9. Macedonian item flag: `"1"` if `macedonianItem == true`, else `"0"`
10. tab
11. correction type, if active:
    - `DISCOUNT_PERCENT` -> `2`
    - `SURCHARGE_PERCENT` -> `1`
    - `DISCOUNT_VALUE` -> `4`
    - `SURCHARGE_VALUE` -> `3`
12. tab
13. correction value formatted with `DecimalFormat("0.00")`
14. tab

Cash-register bytecode snippets:

```text
441: ldc #55 "1"
445: aload_0
446: getfield ReceiptItem.vatGroup
449: getstatic VatGroupEnum.VAT_GROUP_B
452: if_acmpne 462
455: ldc #57 "2"
...
472: ldc #59 "3"
...
489: ldc #61 "4"
...
493: ldc #62 "0"
497: aload_0
498: getfield ReceiptItem.macedonianItem:Z
501: ifeq 508
504: ldc #55 "1"
...
625: aload_0
626: getfield ReceiptItem.description
629: invokevirtual String.toUpperCase
632: invokestatic CyrillicConverter.translateToCyrillic
...
653: aload_2
654: aload_0
655: getfield ReceiptItem.price:D
658: invokevirtual DecimalFormat.format
661: invokestatic Utils.replaceAllDecimalSeparators
...
672: aload 6  // quantity string
```

Correction mapping bytecode:

```text
552: aload_0
553: getfield ReceiptItem.priceCorrectionTypeEnum
556: getstatic PriceCorrectionTypeEnum.DISCOUNT_PERCENT
559: if_acmpne 568
562: iconst_2
563: istore 9
...
572: getstatic PriceCorrectionTypeEnum.SURCHARGE_PERCENT
578: iconst_1
...
588: getstatic PriceCorrectionTypeEnum.DISCOUNT_VALUE
594: iconst_4
...
604: getstatic PriceCorrectionTypeEnum.SURCHARGE_VALUE
610: iconst_3
```

Example payloads:

```text
PRINTER item:
"Coffee<TAB>А10.00*2.000"

CASH_REGISTER item without correction:
"COFFEE<TAB>1<TAB>10.00<TAB>2.000<TAB>0<TAB><TAB><TAB>"
```

The exact visible VAT character for printer payload comes from `VatGroupEnum.getValue()`:

```text
VAT_GROUP_A -> char code 1040
VAT_GROUP_B -> char code 1041
VAT_GROUP_V -> char code 1042
VAT_GROUP_G -> char code 1043
```

Those are Cyrillic characters encoded later through `cp1251`.

### RegisterItemSale

- CommandsEnum: `REGISTER_ITEM_SALE`
- Command ID: decimal `58`, hex `0x3A`
- Java command class: UNKNOWN

No concrete command class referencing `CommandsEnum.REGISTER_ITEM_SALE` was found in the scanned command package list from `Ecr-1.7.739.jar`. Therefore constructor parameters, `toIntList()` payload format, response parser, separators, numeric formatting, and examples are UNKNOWN.

### Subtotal

- CommandsEnum: `SUBTOTAL`
- Command ID: decimal `51`, hex `0x33`
- Java command class: UNKNOWN

No concrete command class referencing `CommandsEnum.SUBTOTAL` was found in the scanned command package list from `Ecr-1.7.739.jar`. Therefore constructor parameters, `toIntList()` payload format, response parser, separators, numeric formatting, and examples are UNKNOWN.

### CalculateTotal

Two concrete classes use `CommandsEnum.CALCULATE_TOTAL`.

#### PaymentMethod

- Java class: `ecr.ecrcommunication.commands.fiscalreceipt.PaymentMethod`
- Package path: `ecr/ecrcommunication/commands/fiscalreceipt/PaymentMethod.class`
- Constructors:
  - `PaymentMethod()`
  - `PaymentMethod(PaymentMethodEnum paymentMethod, double value)`
  - `PaymentMethod(PaymentMethodEnum paymentMethod)`
- CommandsEnum: `CALCULATE_TOTAL`
- Command ID: decimal `53`, hex `0x35`
- Response parsing method: no command-specific response parser found.

Default constructor fields:

- `infoLine1 = null`
- `infoLine2 = null`
- `paymentMethod = PaymentMethodEnum.CASH`
- `value = 0`

Printer payload format:

```text
[infoLine1][LF + infoLine2 if present]<TAB>[paymentMethodChar + amount if paymentMethod != null and value > 0, otherwise TAB if paymentMethod == null]
```

Printer details from `PaymentMethod.toIntList()`:

- `infoLine1.trim()` is appended if non-null and non-empty.
- If `infoLine2.trim()` is non-null and non-empty, byte `10` is appended, then `infoLine2.trim()`.
- Byte `9` (tab) is always appended after info lines.
- If `paymentMethod != null` and `value > 0`, append `paymentMethod.GetValue()` char and `value` formatted with `DecimalFormat("0.00")`.
- If `paymentMethod == null`, another byte `9` is appended.

Printer bytecode snippet:

```text
51: aload_1
52: aload_0
53: getfield PaymentMethod.infoLine1
56: invokevirtual String.trim
59: invokestatic Utils.getIntListFromString
...
90: aload_1
91: bipush 10
...
119: aload_1
120: bipush 9
...
147: aload_1
148: aload_0
149: getfield PaymentMethod.paymentMethod
152: invokevirtual PaymentMethodEnum.GetValue:()C
...
164: aload_2
165: aload_0
166: getfield PaymentMethod.value:D
169: invokevirtual DecimalFormat.format
172: invokestatic Utils.replaceAllDecimalSeparators
```

Cash-register payload format:

```text
<paymentTypeNumber><TAB><amount if value > 0><TAB>
```

Cash-register payment type mapping in `PaymentMethod.toIntList()`:

- default `"0"`
- `DEBIT` -> `"1"`
- `CREDIT` -> `"2"`
- `CASH` and `CHECK` are not separately mapped in this cash-register branch and remain `"0"` unless more code outside this method changes inputs.

Cash-register bytecode snippet:

```text
214: ldc #26 "0"
217: aload_0
218: getfield PaymentMethod.paymentMethod
221: getstatic PaymentMethodEnum.DEBIT
224: if_acmpne 233
227: ldc #28 "1"
...
233: aload_0
234: getfield PaymentMethod.paymentMethod
237: getstatic PaymentMethodEnum.CREDIT
240: if_acmpne 246
243: ldc #30 "2"
...
279: aload_3
283: ldc #35 "\t"
288: aload 4
293: ldc #35 "\t"
```

Payment enum values from `PaymentMethodEnum.<clinit>`:

```text
CASH   -> char code 80  ('P')
CREDIT -> char code 78  ('N')
CHECK  -> char code 67  ('C')
DEBIT  -> char code 68  ('D')
```

Example payload:

```text
PRINTER, cash 25.50: "P25.50" preceded by a tab after info lines
CASH_REGISTER, debit 25.50: "1<TAB>25.50<TAB>"
```

#### GetTotal

- Java class: `ecr.ecrcommunication.commands.info.GetTotal`
- Package path: `ecr/ecrcommunication/commands/info/GetTotal.class`
- Constructor: `GetTotal(PaymentMethodEnum paymentMethodInUse, double value)`
- CommandsEnum: `CALCULATE_TOTAL`
- Command ID: decimal `53`, hex `0x35`
- Response parsing method: no command-specific response parser found.

Payload format:

```text
<TAB>[paymentMethodChar + amount if paymentMethodInUse != null and value > 0]
```

Bytecode snippet:

```text
18: aload_1
19: bipush 9
...
30: aload_0
31: getfield GetTotal.paymentMethodInUse
34: ifnull 86
37: aload_0
38: getfield GetTotal.value:D
41: dconst_0
42: dcmpl
43: ifle 86
46: aload_1
47: aload_0
48: getfield GetTotal.paymentMethodInUse
51: invokevirtual PaymentMethodEnum.GetValue:()C
...
63: aload_2
64: aload_0
65: getfield GetTotal.value:D
68: invokevirtual DecimalFormat.format
71: invokestatic Utils.replaceAllDecimalSeparators
```

### CloseFiscalReceipt

- Java class: `ecr.ecrcommunication.commands.fiscalreceipt.CloseFiscalReceipt`
- Package path: `ecr/ecrcommunication/commands/fiscalreceipt/CloseFiscalReceipt.class`
- Constructor: `CloseFiscalReceipt()`
- CommandsEnum: `CLOSE_FISCAL_RECEIPT`
- Command ID: decimal `56`, hex `0x38`
- Response parsing method: no command-specific response parser found.

Class/method: `CloseFiscalReceipt.toIntList()`

Payload: `null`

```text
0: aconst_null
1: areturn
```

### CancelFiscalReceipt

- Java class: `ecr.ecrcommunication.commands.fiscalreceipt.CancelFiscalReceipt`
- Package path: `ecr/ecrcommunication/commands/fiscalreceipt/CancelFiscalReceipt.class`
- Constructor: `CancelFiscalReceipt()`
- CommandsEnum: `CANCEL_FISCAL_RECEIPT`
- Command ID: decimal `60`, hex `0x3C`
- Response parsing method: no command-specific response parser found.

Class/method: `CancelFiscalReceipt.toIntList()`

Payload: `null`

```text
0: aconst_null
1: areturn
```

## Status And Diagnostic Commands

### GetStatus

- Java class: `ecr.ecrcommunication.commands.info.GetStatus`
- Package path: `ecr/ecrcommunication/commands/info/GetStatus.class`
- Constructor: `GetStatus()`
- CommandsEnum: `GET_STATUS_BYTES`
- Command ID: decimal `74`, hex `0x4A`
- Response parsing method: no command-specific response parser found.

Class/method: `GetStatus.toIntList()`

Payload: `null`

```text
0: aconst_null
1: areturn
```

### GetDiagnosticInformationPrinter

- Java class: `ecr.ecrcommunication.commands.info.GetDiagnosticInformationPrinter`
- Package path: `ecr/ecrcommunication/commands/info/GetDiagnosticInformationPrinter.class`
- Constructor: `GetDiagnosticInformationPrinter()`
- CommandsEnum: `GET_DIAGNOSTIC_INFORMATION`
- Command ID: decimal `90`, hex `0x5A`
- Response parsing method: no command-specific response parser found.

Class/method: `GetDiagnosticInformationPrinter.toIntList()`

Payload format:

```text
"1"
```

Encoding: `Utils.getIntListFromString("1")`, therefore `cp1251`.

```text
0: ldc "1"
2: invokestatic Utils.getIntListFromString:(Ljava/lang/String;)Ljava/util/List;
5: areturn
```

## Reports And Date/Time Commands

### DailyFinancialReport

- Java class: `ecr.ecrcommunication.commands.reports.DailyClosureReport`
- Package path: `ecr/ecrcommunication/commands/reports/DailyClosureReport.class`
- Constructors:
  - `DailyClosureReport()`
  - `DailyClosureReport(DailyClosureReportOptionEnum option)`
- CommandsEnum: `DAILY_FINANCIAL_REPORT`
- Command ID: decimal `69`, hex `0x45`
- Response parsing method: no command-specific response parser found.

Default option: `FISCAL_CLOSURE_WITH_REGISTERS`.

Daily closure option enum values from `DailyClosureReportOptionEnum.<clinit>`:

```text
FISCAL_CLOSURE_WO_REGISTERS              -> char code 48 ('0')
FISCAL_CLOSURE_WITH_REGISTERS            -> char code 49 ('1')
REPORT_WO_FISCAL_CLOSURE_WO_REGISTERS    -> char code 50 ('2')
REPORT_WO_FISCAL_CLOSURE_WITH_REGISTERS  -> char code 51 ('3')
CASH_REGISTER_REPORT                     -> char code 52 ('4')
```

Printer payload:

- A new `ArrayList` is created.
- It appends `(int) option.getValue()`.
- This is a numeric byte value, not a string conversion in the visible bytecode.

Cash-register payload:

- Default string: `"X"`
- If option is `FISCAL_CLOSURE_WITH_REGISTERS` or `FISCAL_CLOSURE_WO_REGISTERS`, string becomes `"Z"`
- Then tab is appended.
- Encoding: `Utils.getIntListFromString(...)`

Decompiled-equivalent snippet:

```java
if (Constants.deviceType == DeviceTypeEnum.PRINTER) {
    list.add((int) option.getValue());
}
if (Constants.deviceType == DeviceTypeEnum.CASH_REGISTER) {
    String closureType = "X";
    if (option == FISCAL_CLOSURE_WITH_REGISTERS || option == FISCAL_CLOSURE_WO_REGISTERS) {
        closureType = "Z";
    }
    return Utils.getIntListFromString(closureType + "\t");
}
```

### GetDateTime

- Java class: `ecr.ecrcommunication.commands.info.GetDateTime`
- Package path: `ecr/ecrcommunication/commands/info/GetDateTime.class`
- Constructor: `GetDateTime()`
- CommandsEnum: `GET_DATE_TIME`
- Command ID: decimal `62`, hex `0x3E`
- Response parsing method: no command-specific response parser found.

Class/method: `GetDateTime.toIntList()`

Payload: `null`

```text
0: aconst_null
1: areturn
```

### SetDateTime

- Java class: `ecr.ecrcommunication.commands.SetDateTime`
- Package path: `ecr/ecrcommunication/commands/SetDateTime.class`
- Constructor: `SetDateTime(Date date)`
- CommandsEnum: `SET_DATE_TIME`
- Command ID: decimal `61`, hex `0x3D`
- Response parsing method: no command-specific response parser found.

Class/method: `SetDateTime.toIntList()`

Payload format:

```text
<dd-MM-yy> <HH:mm:ss>[TAB only for cash register]
```

Date/time formatting uses:

- `Globals.GetDate(date, "dd-MM-yy")`
- literal space `" "`
- `Globals.GetDate(date, "HH:mm:ss")`
- for cash register, appends `"\t"`

Encoding: `Utils.getIntListFromString(...)`, therefore `cp1251`.

Example payload:

```text
PRINTER:        "07-07-26 14:30:00"
CASH_REGISTER: "07-07-26 14:30:00<TAB>"
```

## Article And Item Report Commands

### ProgramArticle

- Java class: `ecr.ecrcommunication.commands.articles.ProgramArticle`
- Package path: `ecr/ecrcommunication/commands/articles/ProgramArticle.class`
- Constructor: `ProgramArticle(Article article)`
- CommandsEnum: `SET_AND_READ_ITEMS`
- Command ID: decimal `107`, hex `0x6B`
- Response parsing method: no command-specific response parser found.

Related data class: `ecr.ecrcommunication.commands.articles.Article`

Visible constructor:

```text
Article(int code, VatGroupEnum vatGroup, double price, String name)
```

Article default fields from `Article.<init>`:

- `code = -1`, then constructor sets argument
- `vatGroup = VAT_GROUP_A`, then constructor sets argument
- `price = 0`, then constructor sets argument
- `name = ""`, then constructor sets argument
- `department = 1`
- `group = 1`
- `priceType = 3`
- `quantity = 0`
- `barcode1 = "0"`
- `barcode2 = "0"`
- `barcode3 = "0"`
- `barcode4 = "0"`
- `row = -1`

Class/method: `ProgramArticle.toIntList()`

The method starts with payload prefix `"P"` encoded through `Utils.getIntListFromString("P")`, then appends the device-specific article body.

```text
10: ldc #7 "P"
12: invokestatic Utils.getIntListFromString:(Ljava/lang/String;)Ljava/util/List;
15: astore_2
...
448: aload_2
449: aload_3
450: invokestatic Utils.getIntListFromString:(Ljava/lang/String;)Ljava/util/List;
453: invokeinterface List.addAll
459: aload_2
460: areturn
```

Printer payload body:

```text
<vatGroupChar><articleCode>,<price 0.00>,<ARTICLE_NAME_UPPER>
```

Complete printer payload:

```text
P<vatGroupChar><articleCode>,<price>,<ARTICLE_NAME_UPPER>
```

Printer bytecode snippet:

```text
34: aload_0
35: getfield ProgramArticle.article
38: invokevirtual Article.getVatGroup
41: invokevirtual VatGroupEnum.getValue:()C
...
52: aload_0
53: getfield ProgramArticle.article
56: invokevirtual Article.getCode:()I
62: ldc #21 ","
...
67: aload_1
68: aload_0
69: getfield ProgramArticle.article
72: invokevirtual Article.getPrice:()D
75: invokevirtual DecimalFormat.format
78: invokestatic Utils.replaceAllDecimalSeparators
84: ldc #21 ","
...
89: aload_0
90: getfield ProgramArticle.article
93: invokevirtual Article.getName
96: invokevirtual String.toUpperCase
```

Cash-register payload body:

```text
<TAB><code><TAB><taxGroupNumber><TAB><department><TAB><group><TAB><priceType><TAB><price 0.00><TAB><empty field><TAB><quantity 0.00><TAB><barcode1><TAB><barcode2><TAB><barcode3><TAB><barcode4><TAB><NAME_UPPER_CYRILLIC><TAB>
```

Complete cash-register payload:

```text
P<TAB><code><TAB><taxGroupNumber><TAB><department><TAB><group><TAB><priceType><TAB><price><TAB><empty><TAB><quantity><TAB><barcode1><TAB><barcode2><TAB><barcode3><TAB><barcode4><TAB><NAME><TAB>
```

Cash-register tax group mapping:

- `VAT_GROUP_A` -> `"1"`
- `VAT_GROUP_B` -> `"2"`
- `VAT_GROUP_V` -> `"3"`
- `VAT_GROUP_G` -> `"4"`

Cash-register name handling:

```text
183: aload_0
184: getfield ProgramArticle.article
187: invokevirtual Article.getName
190: invokevirtual String.toUpperCase
193: astore 6
195: aload 6
197: invokestatic CyrillicConverter.translateToCyrillic
```

Cash-register field order bytecode snippet:

```text
209: ldc #37 "\t"
214: aload_0 ... Article.getCode
224: ldc #37 "\t"
229: aload 4                       // taxGroupNumber
234: ldc #37 "\t"
239: aload_0 ... Article.getDepartment
252: ldc #37 "\t"
257: aload_0 ... Article.getGroup
270: ldc #37 "\t"
275: aload_0 ... Article.getPriceType
288: ldc #37 "\t"
293: aload_1 ... Article.getPrice
310: ldc #37 "\t"
315: aload 5                       // empty string
320: ldc #37 "\t"
325: aload_1 ... Article.getQuantity
342: ldc #37 "\t"
347: aload_0 ... Article.getBarcode1
357: ldc #37 "\t"
362: aload_0 ... Article.getBarcode2
372: ldc #37 "\t"
377: aload_0 ... Article.getBarcode3
387: ldc #37 "\t"
392: aload_0 ... Article.getBarcode4
402: ldc #37 "\t"
407: aload 6                       // translated name
412: ldc #37 "\t"
```

Numeric formatting:

- price: `DecimalFormat("0.00")`
- quantity in `ProgramArticle`: also `DecimalFormat("0.00")`
- decimal comma replaced with dot

Example payload:

```text
PRINTER:        "PА1001,12.50,COFFEE"
CASH_REGISTER: "P<TAB>1001<TAB>1<TAB>1<TAB>1<TAB>3<TAB>12.50<TAB><TAB>0.00<TAB>0<TAB>0<TAB>0<TAB>0<TAB>COFFEE<TAB>"
```

The displayed `А` in the printer example represents `VAT_GROUP_A` char code `1040`; exact rendered byte depends on `cp1251` encoding.

### ItemsReport

- Java class: `ecr.ecrcommunication.commands.reports.ArticlesReport`
- Package path: `ecr/ecrcommunication/commands/reports/ArticlesReport.class`
- Constructor: `ArticlesReport(boolean quantityReport)`
- CommandsEnum: `ITEMS_REPORT`
- Command ID: decimal `111`, hex `0x6F`
- Response parsing method: no command-specific response parser found.

Class/method: `ArticlesReport.toIntList()`

Printer payload:

```text
"0"
```

Cash-register payload:

```text
<reportCode><TAB><TAB><TAB>
```

Cash-register report code:

- default `"2"`
- if `quantityReport == true`, `"3"`

Decompiled-equivalent snippet:

```java
if (Constants.deviceType == DeviceTypeEnum.PRINTER) {
    return Utils.getIntListFromString("0");
}
if (Constants.deviceType == DeviceTypeEnum.CASH_REGISTER) {
    String code = quantityReport ? "3" : "2";
    return Utils.getIntListFromString(code + "\t\t\t");
}
```

## Duplicate Print Command

### PrintDuplicate

- Java class: `ecr.ecrcommunication.commands.fiscalreceipt.PrintDuplicateFiscalReceipt`
- Package path: `ecr/ecrcommunication/commands/fiscalreceipt/PrintDuplicateFiscalReceipt.class`
- Constructor: `PrintDuplicateFiscalReceipt()`
- CommandsEnum: `PRINT_DUPLICATE`
- Command ID: decimal `109`, hex `0x6D`
- Response parsing method: no command-specific response parser found.

Class/method: `PrintDuplicateFiscalReceipt.toIntList()`

Payload format:

```text
"1"
```

Encoding: `Utils.getIntListFromString("1")`, therefore `cp1251`.

```text
0: ldc "1"
2: invokestatic Utils.getIntListFromString:(Ljava/lang/String;)Ljava/util/List;
5: areturn
```

## Enum Value Tables Used By Payloads

### PaymentMethodEnum

Class/method: `ecr.ecrcommunication.enums.PaymentMethodEnum.<clinit>`

| enum name | integer/char code | character |
|---|---:|---|
| `CASH` | 80 | `P` |
| `CREDIT` | 78 | `N` |
| `CHECK` | 67 | `C` |
| `DEBIT` | 68 | `D` |

### VatGroupEnum

Class/method: `ecr.ecrcommunication.enums.VatGroupEnum.<clinit>`

| enum name | integer/char code | note |
|---|---:|---|
| `VAT_GROUP_A` | 1040 | Cyrillic `А` |
| `VAT_GROUP_B` | 1041 | Cyrillic `Б` |
| `VAT_GROUP_V` | 1042 | Cyrillic `В` |
| `VAT_GROUP_G` | 1043 | Cyrillic `Г` |

For cash-register payload branches in `ReceiptItem.toIntList()` and `ProgramArticle.toIntList()`, these enum values are not emitted directly; the code maps the enum to string numbers `"1"` through `"4"`.

### PriceCorrectionTypeEnum

Class/method: `ecr.ecrcommunication.enums.PriceCorrectionTypeEnum.<clinit>`

| enum name | constructor integer |
|---|---:|
| `NONE` | 0 |
| `DISCOUNT_PERCENT` | 1 |
| `DISCOUNT_VALUE` | 2 |
| `SURCHARGE_PERCENT` | 3 |
| `SURCHARGE_VALUE` | 4 |

In `ReceiptItem.toIntList()` cash-register payloads, the emitted correction type numbers differ from constructor order:

| enum name | emitted cash-register correction type |
|---|---:|
| `DISCOUNT_PERCENT` | 2 |
| `SURCHARGE_PERCENT` | 1 |
| `DISCOUNT_VALUE` | 4 |
| `SURCHARGE_VALUE` | 3 |

### DailyClosureReportOptionEnum

Class/method: `ecr.ecrcommunication.enums.DailyClosureReportOptionEnum.<clinit>`

| enum name | integer/char code | character |
|---|---:|---|
| `FISCAL_CLOSURE_WO_REGISTERS` | 48 | `0` |
| `FISCAL_CLOSURE_WITH_REGISTERS` | 49 | `1` |
| `REPORT_WO_FISCAL_CLOSURE_WO_REGISTERS` | 50 | `2` |
| `REPORT_WO_FISCAL_CLOSURE_WITH_REGISTERS` | 51 | `3` |
| `CASH_REGISTER_REPORT` | 52 | `4` |

## Command Summary Table

| requested command | concrete Java class | enum | id dec | id hex | payload source |
|---|---|---|---:|---:|---|
| GetStatus / GET_STATUS_BYTES | `ecr.ecrcommunication.commands.info.GetStatus` | `GET_STATUS_BYTES` | 74 | `0x4A` | `null` |
| GetDiagnosticInformationPrinter / GET_DIAGNOSTIC_INFORMATION | `ecr.ecrcommunication.commands.info.GetDiagnosticInformationPrinter` | `GET_DIAGNOSTIC_INFORMATION` | 90 | `0x5A` | `"1"` |
| OpenFiscalReceipt / OPEN_FISCAL_RECEIPT | `ecr.ecrcommunication.commands.fiscalreceipt.OpenFiscalReceipt` | `OPEN_FISCAL_RECEIPT` | 48 | `0x30` | device-specific string |
| RegisterSale / REGISTER_SALE | `ecr.ecrcommunication.commands.fiscalreceipt.ReceiptItem` | `REGISTER_SALE` | 49 | `0x31` | device-specific item fields |
| RegisterItemSale / REGISTER_ITEM_SALE | UNKNOWN | `REGISTER_ITEM_SALE` | 58 | `0x3A` | UNKNOWN |
| Subtotal / SUBTOTAL | UNKNOWN | `SUBTOTAL` | 51 | `0x33` | UNKNOWN |
| CalculateTotal / CALCULATE_TOTAL | `PaymentMethod`, `GetTotal` | `CALCULATE_TOTAL` | 53 | `0x35` | payment fields |
| CloseFiscalReceipt / CLOSE_FISCAL_RECEIPT | `ecr.ecrcommunication.commands.fiscalreceipt.CloseFiscalReceipt` | `CLOSE_FISCAL_RECEIPT` | 56 | `0x38` | `null` |
| CancelFiscalReceipt / CANCEL_FISCAL_RECEIPT | `ecr.ecrcommunication.commands.fiscalreceipt.CancelFiscalReceipt` | `CANCEL_FISCAL_RECEIPT` | 60 | `0x3C` | `null` |
| DailyFinancialReport / DAILY_FINANCIAL_REPORT | `ecr.ecrcommunication.commands.reports.DailyClosureReport` | `DAILY_FINANCIAL_REPORT` | 69 | `0x45` | report option |
| GetDateTime / GET_DATE_TIME | `ecr.ecrcommunication.commands.info.GetDateTime` | `GET_DATE_TIME` | 62 | `0x3E` | `null` |
| SetDateTime / SET_DATE_TIME | `ecr.ecrcommunication.commands.SetDateTime` | `SET_DATE_TIME` | 61 | `0x3D` | date/time string |
| ProgramArticle / SET_AND_READ_ITEMS | `ecr.ecrcommunication.commands.articles.ProgramArticle` | `SET_AND_READ_ITEMS` | 107 | `0x6B` | `P` + article fields |
| ItemsReport / ITEMS_REPORT | `ecr.ecrcommunication.commands.reports.ArticlesReport` | `ITEMS_REPORT` | 111 | `0x6F` | report selector |
| PrintDuplicate / PRINT_DUPLICATE | `ecr.ecrcommunication.commands.fiscalreceipt.PrintDuplicateFiscalReceipt` | `PRINT_DUPLICATE` | 109 | `0x6D` | `"1"` |

