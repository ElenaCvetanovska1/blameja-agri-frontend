# PLU Sale Analysis

## Overview

This document answers one architectural question: whether the Java fiscal SDK can register a fiscal sale by referencing an already-programmed article/PLU, or whether sales are always registered by sending the item description, VAT group, price, and quantity.

Search scope was the entire extracted JAR under `Ecr-1.7.739/ecr-expanded-3`. The search included exact and semantic candidates for PLU, article, product, department, barcode, item, register, sale, sell, code, number, identifier, and all command classes extending `AEcrCommand`.

General packet framing, checksum, serial communication, receipt flow, and response parser behavior are intentionally not re-analyzed here.

## Architecture Conclusion

`ReceiptItem` is the ONLY Java command used to register sales.

The SDK contains article programming, reading, deletion, and report commands. Those commands use `SET_AND_READ_ITEMS` and `ITEMS_REPORT`. They do not register a fiscal sale.

The enum contains a sale-like command named `REGISTER_ITEM_SALE` with command ID `0x3A` / decimal `58`, but the JAR contains no concrete `AEcrCommand` subclass that uses it and no UI/service/thread caller that sends it.

Therefore, from Java bytecode evidence, the SDK always registers fiscal sales through `ReceiptItem`, which uses `REGISTER_SALE` command ID `0x31` / decimal `49` and carries explicit item data. No proven Java path sends only `PLU = 1` and `Quantity = 2` to sell a programmed article.

## Candidate Classes

| Section | Class | Package | Superclass | Command enum | Command ID | Actually performs sale? |
|---|---|---|---|---|---:|---|
| A | `Article` | `ecr.ecrcommunication.commands.articles` | `java.lang.Object` | none | none | No |
| A | `ProgramArticle` | `ecr.ecrcommunication.commands.articles` | `AEcrCommand` | `SET_AND_READ_ITEMS` | `0x6B` / 107 | No |
| A | `DeleteArticles` | `ecr.ecrcommunication.commands.articles` | `AEcrCommand` | `SET_AND_READ_ITEMS` | `0x6B` / 107 | No |
| B | `ReadArticle` | `ecr.ecrcommunication.commands.articles` | `AEcrCommand` | `SET_AND_READ_ITEMS` | `0x6B` / 107 | No |
| B | `FindFirstProgrammedArticle` | `ecr.ecrcommunication.commands.articles` | `AEcrCommand` | `SET_AND_READ_ITEMS` | `0x6B` / 107 | No |
| B | `FindNextProgrammedArticle` | `ecr.ecrcommunication.commands.articles` | `AEcrCommand` | `SET_AND_READ_ITEMS` | `0x6B` / 107 | No |
| C | `ArticlesReport` | `ecr.ecrcommunication.commands.reports` | `AEcrCommand` | `ITEMS_REPORT` | `0x6F` / 111 | No |
| D | `ReceiptItem` | `ecr.ecrcommunication.commands.fiscalreceipt` | `AEcrCommand` | `REGISTER_SALE` | `0x31` / 49 | Yes, direct sale |
| D | enum-only `REGISTER_ITEM_SALE` | `ecr.ecrcommunication.enums` | enum constant | `REGISTER_ITEM_SALE` | `0x3A` / 58 | No Java implementation found |
| D | enum-only `REGISTER_SALE_AND_SHOW_ON_SCREEN` | `ecr.ecrcommunication.enums` | enum constant | `REGISTER_SALE_AND_SHOW_ON_SCREEN` | `0x34` / 52 | No Java implementation found |

## Confirmed Programming Commands

### `Article`

Class: `ecr.ecrcommunication.commands.articles.Article`

Purpose proven by bytecode: data model for programmed article information. It is not a command and does not extend `AEcrCommand`.

Constructor:

```java
Article(int code, VatGroupEnum vatGroup, double price, String name)
```

Fields proven by constructor/getters/setters:

| Field | Default | Evidence |
|---|---:|---|
| `code` | `-1` | constructor puts `iconst_m1` into `Article.code` |
| `vatGroup` | `VAT_GROUP_A` | constructor gets `VatGroupEnum.VAT_GROUP_A` |
| `price` | `0.0` | constructor stores `dconst_0` |
| `name` | `""` | constructor stores empty string |
| `programmed` | `false` | constructor stores `iconst_0` |
| `newArticle` | `false` | constructor stores `iconst_0` |
| `department` | `1` | constructor stores `iconst_1` |
| `group` | `1` | constructor stores `iconst_1` |
| `priceType` | `3` | constructor stores `iconst_3` |
| `quantity` | `0.0` | constructor stores `dconst_0` |
| `barcode1..barcode4` | `"0"` | constructor stores string `"0"` |
| `row` | `-1` | constructor stores `iconst_m1` |

Bytecode evidence:

```text
class ecr.ecrcommunication.commands.articles.Article extends java.lang.Object
interfaces []

METHOD <init>(ILecr/ecrcommunication/enums/VatGroupEnum;DLjava/lang/String;)V
  4: aload_0
  5: iconst_m1
  6: putfield Article.code:I
  10: getstatic VatGroupEnum.VAT_GROUP_A
  13: putfield Article.vatGroup
  44: iconst_1
  45: putfield Article.department:I
  54: iconst_3
  55: putfield Article.priceType:I
  64: ldc "0"
  66: putfield Article.barcode1
  92: iload_1
  94: putfield Article.code:I
  98: aload_2
  99: putfield Article.vatGroup
  103: dload_3
  104: putfield Article.price:D
  108: aload 5
  110: putfield Article.name
```

Java equivalent pseudocode:

```java
class Article {
    int code = -1;
    VatGroupEnum vatGroup = VAT_GROUP_A;
    double price = 0;
    String name = "";
    boolean programmed = false;
    boolean newArticle = false;
    int department = 1;
    int group = 1;
    int priceType = 3;
    double quantity = 0;
    String barcode1 = "0";
    String barcode2 = "0";
    String barcode3 = "0";
    String barcode4 = "0";

    Article(int code, VatGroupEnum vatGroup, double price, String name) {
        this.code = code;
        this.vatGroup = vatGroup;
        this.price = price;
        this.name = name;
    }
}
```

Conclusion: this model proves the SDK can store/manage programmed article metadata, including department and barcode fields. It does not prove article sale.

### `ProgramArticle`

Class: `ecr.ecrcommunication.commands.articles.ProgramArticle`

Constructor:

```java
ProgramArticle(Article article)
```

Inheritance/interfaces:

```text
class ecr.ecrcommunication.commands.articles.ProgramArticle extends ecr.ecrcommunication.core.AEcrCommand
interfaces []
```

Command:

| Enum | ID |
|---|---:|
| `SET_AND_READ_ITEMS` | `0x6B` / 107 |

Payload builder:

Printer payload:

```text
P<vatValue><code>,<price 0.00>,<name uppercase>
```

Cash-register payload:

```text
P<TAB><code><TAB><taxGroup><TAB><department><TAB><group><TAB><priceType><TAB><price 0.00><TAB><addQty><TAB><quantity 0.00><TAB><barcode1><TAB><barcode2><TAB><barcode3><TAB><barcode4><TAB><articleName><TAB>
```

The cash-register article name is uppercased and passed through `CyrillicConverter.translateToCyrillic`.

Bytecode evidence:

```text
METHOD <init>(Article)V
  1: getstatic CommandsEnum.SET_AND_READ_ITEMS
  4: invokespecial AEcrCommand.<init>(CommandsEnum)
  13: aload_1
  14: putfield ProgramArticle.article

METHOD toIntList()
  4: ldc "0.00"
  6: invokespecial DecimalFormat.<init>
  10: ldc "P"
  12: invokestatic Utils.getIntListFromString

Printer branch:
  38: invokevirtual Article.getVatGroup
  41: invokevirtual VatGroupEnum.getValue
  56: invokevirtual Article.getCode
  62: ldc ","
  72: invokevirtual Article.getPrice
  78: invokestatic Utils.replaceAllDecimalSeparators
  84: ldc ","
  93: invokevirtual Article.getName
  96: invokevirtual String.toUpperCase

Cash-register branch:
  209: ldc "\t"
  218: invokevirtual Article.getCode
  243: invokevirtual Article.getDepartment
  261: invokevirtual Article.getGroup
  279: invokevirtual Article.getPriceType
  298: invokevirtual Article.getPrice
  330: invokevirtual Article.getQuantity
  351: invokevirtual Article.getBarcode1
  366: invokevirtual Article.getBarcode2
  381: invokevirtual Article.getBarcode3
  396: invokevirtual Article.getBarcode4
  407: aload articleName
  449: aload_3
  450: invokestatic Utils.getIntListFromString
  453: invokeinterface List.addAll
```

Java equivalent pseudocode:

```java
ProgramArticle(Article article) : super(SET_AND_READ_ITEMS) {
    this.article = article;
}

List<Integer> toIntList() {
    DecimalFormat df = new DecimalFormat("0.00");
    List<Integer> result = Utils.getIntListFromString("P");

    if (deviceType == PRINTER) {
        str = article.getVatGroup().getValue()
            + "" + article.getCode()
            + "," + fmt2(article.getPrice())
            + "," + article.getName().toUpperCase();
    }

    if (deviceType == CASH_REGISTER) {
        taxGroup = "1"; // B=2, V=3, G=4
        articleName = CyrillicConverter.translateToCyrillic(article.getName().toUpperCase());
        str = "\t" + article.getCode()
            + "\t" + taxGroup
            + "\t" + article.getDepartment()
            + "\t" + article.getGroup()
            + "\t" + article.getPriceType()
            + "\t" + fmt2(article.getPrice())
            + "\t" + ""
            + "\t" + fmt2(article.getQuantity())
            + "\t" + article.getBarcode1()
            + "\t" + article.getBarcode2()
            + "\t" + article.getBarcode3()
            + "\t" + article.getBarcode4()
            + "\t" + articleName
            + "\t";
    }

    result.addAll(Utils.getIntListFromString(str));
    return result;
}
```

Caller/workflow evidence:

| Caller | Method | Use |
|---|---|---|
| `Ecr` | `programArticle(Article)` | sends `new ProgramArticle(article)` |
| `ArticlesPanel$10` | `run()` | validates UI article rows, then calls `Constants.ECR.programArticle(article)` |
| `ArticlesPanel$11$1` | `run()` | creates a test `Article`, then calls `Constants.ECR.programArticle(article)` |

This is article programming only. No sale is opened, no `ReceiptItem` is created, and no `REGISTER_SALE` or `REGISTER_ITEM_SALE` command is used by this class.

### `DeleteArticles`

Class: `ecr.ecrcommunication.commands.articles.DeleteArticles`

Constructors:

```java
DeleteArticles()
DeleteArticles(String plu)
DeleteArticles(int fromPlu, int toPlu)
```

Inheritance/interfaces:

```text
class ecr.ecrcommunication.commands.articles.DeleteArticles extends ecr.ecrcommunication.core.AEcrCommand
interfaces []
```

Command:

| Enum | ID |
|---|---:|
| `SET_AND_READ_ITEMS` | `0x6B` / 107 |

Payload builder:

| Mode | Payload after `D` prefix |
|---|---|
| Printer delete all | `A` |
| Printer delete one | `<plu>` |
| Printer delete range | `<fromPlu>,<toPlu>` |
| Cash register delete all | `<TAB>A<TAB><TAB>` |
| Cash register delete one | `<TAB><plu><TAB><plu><TAB>` |
| Cash register delete range | `<TAB><fromPlu><TAB><toPlu><TAB>` |

Bytecode evidence:

```text
METHOD <init>()V
  1: getstatic CommandsEnum.SET_AND_READ_ITEMS
  4: invokespecial AEcrCommand.<init>
  29: iconst_0
  30: putfield DeleteArticles.deleteType

METHOD <init>(String)V
  29: aload_1
  30: putfield DeleteArticles.plu
  34: iconst_1
  35: putfield DeleteArticles.deleteType

METHOD <init>(II)V
  29: iload_1
  30: putfield DeleteArticles.fromPlu
  34: iload_2
  35: putfield DeleteArticles.toPlu
  39: iconst_2
  40: putfield DeleteArticles.deleteType

METHOD toIntList()
  3: ldc "D"
  5: invokestatic Utils.getIntListFromString
  27: ldc "A"
  44: getfield DeleteArticles.plu
  80: append ","
  113: ldc "\t"
```

Java equivalent pseudocode:

```java
DeleteArticles() : super(SET_AND_READ_ITEMS) {
    deleteType = 0;
}

DeleteArticles(String plu) : super(SET_AND_READ_ITEMS) {
    this.plu = plu;
    deleteType = 1;
}

DeleteArticles(int fromPlu, int toPlu) : super(SET_AND_READ_ITEMS) {
    this.fromPlu = fromPlu;
    this.toPlu = toPlu;
    deleteType = 2;
}

List<Integer> toIntList() {
    result = Utils.getIntListFromString("D");
    if (deviceType == PRINTER) {
        if (deleteType == 0) list = "A";
        if (deleteType == 1) list = plu;
        if (deleteType == 2) list = fromPlu + "," + toPlu;
    }
    if (deviceType == CASH_REGISTER) {
        if (deleteType == 0) list = "\tA\t\t";
        if (deleteType == 1) list = "\t" + plu + "\t" + plu + "\t";
        if (deleteType == 2) list = "\t" + fromPlu + "\t" + toPlu + "\t";
    }
    result.addAll(Utils.getIntListFromString(list));
    return result;
}
```

Caller/workflow evidence:

| Caller | Method | Use |
|---|---|---|
| `Ecr` | `deleteAllArticles()` | sends `new DeleteArticles()` |
| `Ecr` | `deleteArticle(String plu)` | sends `new DeleteArticles(plu)` |
| `ArticlesPanel$5$1` | `run()` | selected article deletion calls `Constants.ECR.deleteArticle(Integer.toString(article.getCode()))` |
| `ArticlesPanel$7$1` | `run()` | delete-all UI path calls `Constants.ECR.deleteAllArticles()` |

This is article deletion/programming management only. It does not perform a sale.

## Confirmed Reading Commands

### `ReadArticle`

Class: `ecr.ecrcommunication.commands.articles.ReadArticle`

Constructor:

```java
ReadArticle(int plu)
```

Inheritance/interfaces:

```text
class ecr.ecrcommunication.commands.articles.ReadArticle extends ecr.ecrcommunication.core.AEcrCommand
interfaces []
```

Command:

| Enum | ID |
|---|---:|
| `SET_AND_READ_ITEMS` | `0x6B` / 107 |

Payload builder:

```text
R<TAB><plu><TAB>
```

Bytecode evidence:

```text
METHOD <init>(I)V
  1: getstatic CommandsEnum.SET_AND_READ_ITEMS
  4: invokespecial AEcrCommand.<init>
  13: iload_1
  14: putfield ReadArticle.plu

METHOD toIntList()
  7: ldc "R\t"
  13: getfield ReadArticle.plu
  16: invokestatic Integer.toString
  22: ldc "\t"
  30: invokestatic Utils.getIntListFromString
```

Java equivalent pseudocode:

```java
ReadArticle(int plu) : super(SET_AND_READ_ITEMS) {
    this.plu = plu;
}

List<Integer> toIntList() {
    return Utils.getIntListFromString("R\t" + plu + "\t");
}
```

Caller evidence: no application caller was found in the semantic JAR search. The class exists, but no UI/service/thread path was found that sends it.

This reads an article by PLU. It does not perform a sale.

### `FindFirstProgrammedArticle`

Class: `ecr.ecrcommunication.commands.articles.FindFirstProgrammedArticle`

Constructor:

```java
FindFirstProgrammedArticle()
```

Command:

| Enum | ID |
|---|---:|
| `SET_AND_READ_ITEMS` | `0x6B` / 107 |

Payload builder:

| Device type | Payload |
|---|---|
| Printer | `F` |
| Cash register | `F<TAB><TAB>` |

Bytecode evidence:

```text
class FindFirstProgrammedArticle extends AEcrCommand

METHOD <init>()V
  1: getstatic CommandsEnum.SET_AND_READ_ITEMS
  4: invokespecial AEcrCommand.<init>

METHOD toIntList()
  2: ldc "F"
  4: invokestatic Utils.getIntListFromString
  17: aload_1
  18: ldc "\t\t"
  20: invokestatic Utils.getIntListFromString
  23: invokeinterface List.addAll
```

Java equivalent pseudocode:

```java
FindFirstProgrammedArticle() : super(SET_AND_READ_ITEMS) {}

List<Integer> toIntList() {
    result = Utils.getIntListFromString("F");
    if (deviceType == CASH_REGISTER) {
        result.addAll(Utils.getIntListFromString("\t\t"));
    }
    return result;
}
```

### `FindNextProgrammedArticle`

Class: `ecr.ecrcommunication.commands.articles.FindNextProgrammedArticle`

Constructor:

```java
FindNextProgrammedArticle()
```

Command:

| Enum | ID |
|---|---:|
| `SET_AND_READ_ITEMS` | `0x6B` / 107 |

Payload builder:

| Device type | Payload |
|---|---|
| Printer | `N` |
| Cash register | `N<TAB>` |

Bytecode evidence:

```text
class FindNextProgrammedArticle extends AEcrCommand

METHOD <init>()V
  1: getstatic CommandsEnum.SET_AND_READ_ITEMS
  4: invokespecial AEcrCommand.<init>

METHOD toIntList()
  0: ldc "N"
  2: invokestatic Utils.getIntListFromString
  15: aload_1
  16: ldc "\t"
  18: invokestatic Utils.getIntListFromString
  21: invokeinterface List.addAll
```

Java equivalent pseudocode:

```java
FindNextProgrammedArticle() : super(SET_AND_READ_ITEMS) {}

List<Integer> toIntList() {
    result = Utils.getIntListFromString("N");
    if (deviceType == CASH_REGISTER) {
        result.addAll(Utils.getIntListFromString("\t"));
    }
    return result;
}
```

### Article Read Parsing

Class: `Article`

Method: `createArticleFromString(String str)`

Printer parsing:

```text
split by ","
requires at least 8 fields
code = field[1]
vat = VatGroupEnum.getByValue(field[3].charAt(0))
price = field[4]
name = field[7]
programmed = true
```

Cash-register parsing:

```text
split by TAB
requires at least 15 fields
code = field[1]
vat type = field[2] where 1=A, 2=B, 3=V, 4=G
department = field[3]
group = field[4]
priceType = field[5]
price = field[6]
quantity = field[9]
barcode1 = field[10]
barcode2 = field[11]
barcode3 = field[12]
barcode4 = field[13]
name = field[14].toUpperCase()
programmed = true
```

Bytecode evidence:

```text
METHOD createArticleFromString(String)
  14: ldc ","
  16: invokevirtual String.split
  22: bipush 8
  29: aaload field[1]
  30: invokestatic Integer.parseInt
  35: aaload field[3]
  40: invokevirtual String.charAt
  41: invokestatic VatGroupEnum.getByValue
  47: aaload field[4]
  49: invokestatic Double.parseDouble
  55: bipush 7
  57: aaload field[7]
  60: new Article
  76: iconst_1
  77: invokevirtual Article.setProgrammed

  129: ldc "\t"
  131: invokevirtual String.split
  137: bipush 15
  143: iconst_1
  145: aaload field[1]
  155: iconst_2
  157: aaload field[2]
  202: iconst_3
  204: aaload field[3]
  210: iconst_4
  212: aaload field[4]
  218: iconst_5
  220: aaload field[5]
  226: bipush 6
  228: aaload field[6]
  235: bipush 9
  237: aaload field[9]
  244..264: fields[10..13] barcode1..barcode4
  268: bipush 14
  270: aaload field[14]
```

Reading callers:

| Caller | Method | Use |
|---|---|---|
| `Ecr` | `readAllArticles()` | sends `FindFirstProgrammedArticle`, then loops with `FindNextProgrammedArticle` |
| `ArticlesPanel$6$1` | `run()` | sends first/next commands directly, converts data with `Utils.getStringFromIntList`, then calls `Article.createArticleFromString(str)` |

This is reading/enumeration of programmed articles. It does not perform a sale.

## Confirmed Report Commands

### `ArticlesReport`

Class: `ecr.ecrcommunication.commands.reports.ArticlesReport`

Constructor:

```java
ArticlesReport(boolean quantityReport)
```

Inheritance/interfaces:

```text
class ecr.ecrcommunication.commands.reports.ArticlesReport extends ecr.ecrcommunication.core.AEcrCommand
interfaces []
```

Command:

| Enum | ID |
|---|---:|
| `ITEMS_REPORT` | `0x6F` / 111 |

Payload builder:

| Device type | `quantityReport` | Payload |
|---|---:|---|
| Printer | either | `0` |
| Cash register | `false` | `2<TAB><TAB><TAB>` |
| Cash register | `true` | `3<TAB><TAB><TAB>` |

Bytecode evidence:

```text
METHOD <init>(Z)V
  1: getstatic CommandsEnum.ITEMS_REPORT
  4: invokespecial AEcrCommand.<init>
  13: iload_1
  14: putfield ArticlesReport.quantityReport

METHOD toIntList()
  11: ldc "0"
  13: invokestatic Utils.getIntListFromString
  29: ldc "2"
  33: getfield ArticlesReport.quantityReport
  39: ldc "3"
  53: ldc "\t"
  58: ldc "\t"
  63: ldc "\t"
  73: invokestatic Utils.getIntListFromString
```

Java equivalent pseudocode:

```java
ArticlesReport(boolean quantityReport) : super(ITEMS_REPORT) {
    this.quantityReport = quantityReport;
}

List<Integer> toIntList() {
    if (deviceType == PRINTER) {
        return Utils.getIntListFromString("0");
    }

    if (deviceType == CASH_REGISTER) {
        String type = quantityReport ? "3" : "2";
        return Utils.getIntListFromString(type + "\t\t\t");
    }

    return null;
}
```

Caller/workflow evidence:

| Caller | Method | Use |
|---|---|---|
| `Ecr` | `printArticlesReport(boolean quantityReport)` | sends `new ArticlesReport(quantityReport)` |
| `ReportsPanel$1$1` | `run()` | report selection calls `printArticlesReport(false)` or `printArticlesReport(true)` |

This prints item/article reports. It does not register a sale.

## Confirmed Sale Commands

### `ReceiptItem`

Class: `ecr.ecrcommunication.commands.fiscalreceipt.ReceiptItem`

Constructor overloads:

```java
ReceiptItem()
ReceiptItem(String description, VatGroupEnum vatGroup, double price, double quantity, boolean macedonianItem)
ReceiptItem(String description, VatGroupEnum vatGroup, double price, double quantity, boolean macedonianItem,
            PriceCorrectionTypeEnum priceCorrectionTypeEnum, double priceCorrectionValue)
```

Inheritance/interfaces:

```text
class ecr.ecrcommunication.commands.fiscalreceipt.ReceiptItem extends ecr.ecrcommunication.core.AEcrCommand
interfaces []
```

Command:

| Enum | ID |
|---|---:|
| `REGISTER_SALE` | `0x31` / 49 |

Fields used by the command:

| Field | Meaning |
|---|---|
| `description` | item text sent by application |
| `vatGroup` | VAT group sent by application |
| `price` | item price sent by application |
| `quantity` | item quantity sent by application |
| `macedonianItem` | flag sent by application |
| `priceCorrectionTypeEnum` | optional discount/surcharge |
| `priceCorrectionValue` | optional discount/surcharge value |

Fields not present in `ReceiptItem`:

| Missing field |
|---|
| `plu` |
| `articleCode` |
| `articleNumber` |
| `productCode` |
| `department` |
| `barcode` |
| `Article` reference |

Bytecode evidence:

```text
METHOD <init>()V
  1: getstatic CommandsEnum.REGISTER_SALE
  4: invokespecial AEcrCommand.<init>
  8: ldc ""
  10: putfield ReceiptItem.description
  14: getstatic VatGroupEnum.VAT_GROUP_A
  17: putfield ReceiptItem.vatGroup
  22: putfield ReceiptItem.price
  27: putfield ReceiptItem.quantity

METHOD <init>(String,VatGroupEnum,double,double,boolean)V
  1: getstatic CommandsEnum.REGISTER_SALE
  4: invokespecial AEcrCommand.<init>
  48: aload_1
  49: putfield ReceiptItem.description
  53: aload_2
  54: putfield ReceiptItem.vatGroup
  58: dload_3
  59: putfield ReceiptItem.price
  63: dload 5
  65: putfield ReceiptItem.quantity
  69: iload 7
  71: putfield ReceiptItem.macedonianItem

Cash-register toIntList branch:
  625: getfield ReceiptItem.description
  629: invokevirtual String.toUpperCase
  632: invokestatic CyrillicConverter.translateToCyrillic
  643: aload vatGroupMapped
  653: getfield ReceiptItem.price
  672: aload formattedQuantity
  682: aload macedonianFlag
  818: aload payload
  820: invokestatic Utils.getIntListFromString
```

Java equivalent pseudocode:

```java
ReceiptItem(...) : super(REGISTER_SALE) {
    this.description = description;
    this.vatGroup = vatGroup;
    this.price = price;
    this.quantity = quantity;
    this.macedonianItem = macedonianItem;
    this.priceCorrectionTypeEnum = priceCorrectionTypeEnum;
    this.priceCorrectionValue = priceCorrectionValue;
}

List<Integer> toIntList() {
    validate description, price, quantity, vatGroup;
    build sale payload from description, vatGroup, price, quantity,
        macedonianItem, and optional price correction;
    return Utils.getIntListFromString(payload);
}
```

The exact `ReceiptItem` direct-sale payload is already documented in `receipt-flow-analysis.md` and is not repeated here. The relevant architectural evidence is that `ReceiptItem` has no PLU/article reference field and always uses `REGISTER_SALE`.

Confirmed callers:

| Caller | Method | Evidence |
|---|---|---|
| `FiscalReceiptPanel$PrintReceiptThread` | `run()` | constant pool and locals include `ReceiptItem`; no `Article`, `ProgramArticle`, `ReadArticle`, or `REGISTER_ITEM_SALE` |
| `PrintFiscalReceiptThread` | `run()` | constant pool and locals include `ReceiptItem`, `PaymentMethod`, open/close commands |
| `PrintFiscalReceiptsThread` | `run()` | constant pool and locals include `ReceiptItem`, `PaymentMethod`, open/close commands |

### Enum-Only Sale Candidates

`CommandsEnum` contains two sale-like constants that could look relevant:

| Enum constant | ID | Evidence | Concrete command class found? | Caller found? |
|---|---:|---|---|---|
| `REGISTER_SALE_AND_SHOW_ON_SCREEN` | `0x34` / 52 | enum `<clinit>` creates it | No | No |
| `REGISTER_ITEM_SALE` | `0x3A` / 58 | enum `<clinit>` creates it | No | No |

Bytecode evidence:

```text
CommandsEnum.<clinit>()
  285: ldc "REGISTER_SALE"
  287: bipush 18
  289: bipush 49

  317: ldc "REGISTER_SALE_AND_SHOW_ON_SCREEN"
  319: bipush 20
  321: bipush 52

  397: ldc "REGISTER_ITEM_SALE"
  399: bipush 25
  401: bipush 58
```

Search evidence:

```text
REGISTER_ITEM_SALE found in:
- ecr/ecrcommunication/enums/CommandsEnum.class

REGISTER_SALE_AND_SHOW_ON_SCREEN found in:
- ecr/ecrcommunication/enums/CommandsEnum.class
```

No class extending `AEcrCommand` was found with `super(CommandsEnum.REGISTER_ITEM_SALE)`. No UI panel, service, thread, or helper was found that sends `REGISTER_ITEM_SALE`.

## Workflow

This section only records the PLU/article-sale-relevant workflow evidence.

Article-management workflow:

```text
ArticlesPanel UI
  -> Ecr.programArticle(article)
       -> ProgramArticle(article)
       -> SET_AND_READ_ITEMS, "P..."

ArticlesPanel UI
  -> Ecr.deleteArticle(plu) / Ecr.deleteAllArticles()
       -> DeleteArticles(...)
       -> SET_AND_READ_ITEMS, "D..."

ArticlesPanel UI or Ecr.readAllArticles()
  -> FindFirstProgrammedArticle()
  -> FindNextProgrammedArticle()
  -> Article.createArticleFromString(...)

ReportsPanel UI
  -> Ecr.printArticlesReport(quantityReport)
       -> ArticlesReport(quantityReport)
       -> ITEMS_REPORT
```

Sale workflow candidates inspected:

```text
FiscalReceiptPanel$PrintReceiptThread.run()
PrintFiscalReceiptThread.run()
PrintFiscalReceiptsThread.run()
```

All inspected sale workflows instantiate/send `ReceiptItem`. None instantiate/send `ProgramArticle`, `ReadArticle`, `FindFirstProgrammedArticle`, `FindNextProgrammedArticle`, `DeleteArticles`, `ArticlesReport`, or an enum-only `REGISTER_ITEM_SALE` command while registering a sale.

## Bytecode Evidence

### Command IDs

```text
CommandsEnum.<clinit>()
  189: ldc "SET_AND_READ_ITEMS"
  191: bipush 12
  193: bipush 107

  285: ldc "REGISTER_SALE"
  287: bipush 18
  289: bipush 49

  317: ldc "REGISTER_SALE_AND_SHOW_ON_SCREEN"
  319: bipush 20
  321: bipush 52

  397: ldc "REGISTER_ITEM_SALE"
  399: bipush 25
  401: bipush 58

  541: ldc "ITEMS_REPORT"
  543: bipush 34
  545: bipush 111
```

### Article Commands Use `SET_AND_READ_ITEMS`

```text
ProgramArticle.<init>
  getstatic CommandsEnum.SET_AND_READ_ITEMS
  invokespecial AEcrCommand.<init>

ReadArticle.<init>
  getstatic CommandsEnum.SET_AND_READ_ITEMS
  invokespecial AEcrCommand.<init>

DeleteArticles.<init>
  getstatic CommandsEnum.SET_AND_READ_ITEMS
  invokespecial AEcrCommand.<init>

FindFirstProgrammedArticle.<init>
  getstatic CommandsEnum.SET_AND_READ_ITEMS
  invokespecial AEcrCommand.<init>

FindNextProgrammedArticle.<init>
  getstatic CommandsEnum.SET_AND_READ_ITEMS
  invokespecial AEcrCommand.<init>
```

### Article Report Uses `ITEMS_REPORT`

```text
ArticlesReport.<init>
  getstatic CommandsEnum.ITEMS_REPORT
  invokespecial AEcrCommand.<init>
```

### Fiscal Sale Uses `REGISTER_SALE`

```text
ReceiptItem.<init>
  getstatic CommandsEnum.REGISTER_SALE
  invokespecial AEcrCommand.<init>
```

### No PLU Field in Sale Command

`ReceiptItem` declares and uses:

```text
description
vatGroup
price
quantity
macedonianItem
priceCorrectionTypeEnum
priceCorrectionValue
```

It does not declare or load:

```text
plu
article
articleCode
productCode
department
barcode
```

The programmed-article fields are present on `Article`, and are consumed by `ProgramArticle` and `Article.createArticleFromString`, not by `ReceiptItem`.

## Java Pseudocode

### Direct Sale Actually Used

```java
// Confirmed sale path
AEcrCommand sale = new ReceiptItem(
    description,
    vatGroup,
    price,
    quantity,
    macedonianItem,
    priceCorrectionType,
    priceCorrectionValue);

// super command inside ReceiptItem:
super(CommandsEnum.REGISTER_SALE); // 0x31
```

### Programmed Article Management

```java
// Confirmed article programming path
Article article = new Article(code, vatGroup, price, name);
article.setDepartment(department);
article.setGroup(group);
article.setPriceType(priceType);
article.setQuantity(quantity);
article.setBarcode1(barcode1);

AEcrCommand program = new ProgramArticle(article);

// super command inside ProgramArticle:
super(CommandsEnum.SET_AND_READ_ITEMS); // 0x6B
```

### PLU Sale Not Found

```java
// Not found anywhere in bytecode:
AEcrCommand saleByPlu = new RegisterItemSale(plu, quantity);

// Not found anywhere in bytecode:
super(CommandsEnum.REGISTER_ITEM_SALE);
```

## Examples

### Program an Article

Example only shows article programming, not sale.

Printer-style symbolic payload:

```text
P<vatValue>1,1.00,ROBA
```

Cash-register-style payload:

```text
P<TAB>1<TAB>1<TAB>1<TAB>1<TAB>3<TAB>1.00<TAB><TAB>0.00<TAB>0<TAB>0<TAB>0<TAB>0<TAB>ROBA<TAB>
```

### Read an Article by PLU

```text
R<TAB>1<TAB>
```

This reads PLU/article data. It does not sell it.

### Attempted PLU Sale Scenario

Given a printer already contains:

```text
PLU = 1
Name = ROBA
Price = 1.00
VAT = 5%
```

Question:

```text
Can Java print this article by sending only PLU = 1 and Quantity = 2?
```

Answer from bytecode:

```text
No Java SDK command or caller was found that sends only PLU and quantity for a fiscal sale.
```

The proven sale command is:

```text
ReceiptItem(description, vatGroup, price, quantity, ...)
```

and its superclass command is:

```text
CommandsEnum.REGISTER_SALE / 0x31
```

## UNKNOWN Section

| Question | Answer |
|---|---|
| Does the fiscal printer firmware support command `0x3A` / `REGISTER_ITEM_SALE` outside this SDK? | UNKNOWN |
| What is the protocol payload format for `REGISTER_ITEM_SALE`? | UNKNOWN |
| Can another vendor SDK sell by PLU on the same hardware? | UNKNOWN |
| Why does `CommandsEnum` contain `REGISTER_ITEM_SALE` with no command class? | UNKNOWN |
| Why does `CommandsEnum` contain `REGISTER_SALE_AND_SHOW_ON_SCREEN` with no command class? | UNKNOWN |
| Is there a hidden/reflection-based caller for `REGISTER_ITEM_SALE`? | No evidence found in bytecode search; UNKNOWN beyond the searched JAR |
| Can the printer itself internally map description/price/VAT sales to programmed article memory? | UNKNOWN |

## Final Conclusion

ReceiptItem is the ONLY Java command used to register sales.

The Java SDK supports programmed articles for programming, reading, deletion, and reports. It does not provide a proven Java command class or workflow for fiscal sale by programmed article/PLU.

For the specific scenario `PLU = 1`, `Name = ROBA`, `Price = 1.00`, `VAT = 5%`, Java bytecode does not prove any way to print it by sending only `PLU = 1` and `Quantity = 2`. The proven SDK sale architecture sends item details through `ReceiptItem`: description, VAT group, price, and quantity.
