# STORNO (Fiscal Receipt Cancellation / Void) Analysis

> **⚠️ COMMAND-ID CORRECTION (verified from `CommandsEnum.<clinit>` in the real JAR).**
> The command-id table/bytecode originally in this document were **wrong** (misaligned by one
> constant). The authoritative, hardware-consistent ids are:
>
> | Constant | Dec | Hex |
> |---|---:|---:|
> | `OPEN_FISCAL_RECEIPT` | 48 | `0x30` |
> | `REGISTER_SALE` | 49 | `0x31` |
> | `CALCULATE_TOTAL` | 53 | `0x35` |
> | `CLOSE_FISCAL_RECEIPT` | 56 | `0x38` |
> | `CANCEL_FISCAL_RECEIPT` | 60 | `0x3C` |
> | **`OPEN_VOID_RECEIPT`** | **85** | **`0x55`** |
> | **`CLOSE_VOID_RECEIPT`** | **86** | **`0x56`** |
>
> These match the hardware-verified base receipt ids already in FiscalBridge. Any `0x2A / 0x6A /
> 0x34 / 0x36` values elsewhere in this document are superseded by the table above. The *behavioral*
> analysis (void = re-entered positive items, no original reference, device-type dispatch) is
> unaffected. Implemented in FiscalBridge as Option A — see the code and the ids above.

## Overview

**Storno** in this Java SDK (`Ecr-1.7.739`) is implemented as a **void fiscal receipt**: a complete
fiscal receipt (open → items → payment → close) that is opened and closed with *void* command
variants instead of the normal fiscal-receipt commands. The firmware treats everything registered
inside a void receipt as a reversal / cancellation.

The single most important finding for FiscalBridge:

> **Java storno does NOT reference the original receipt.** There is no original fiscal number,
> document number, receipt number, invoice reference, or any correlation field *anywhere* in the
> storno command constructors or payloads. A storno is just "a receipt opened in void mode", and the
> items/prices/quantities are entered again as **positive** values.

Second most important finding:

> **Items and payments inside a storno are identical to a normal sale** — same `ReceiptItem`
> (`REGISTER_SALE`) command, same `PaymentMethod` (`CALCULATE_TOTAL`) command, with **positive**
> price, **positive** quantity and **positive** payment amount. There is **no negative quantity, no
> negative amount, no dedicated storno-item command, and no refund payment method.** The SDK's own
> validators even *reject* negative price/quantity.

The difference between a sale and a storno is entirely in the **OPEN** and **CLOSE** commands.

Packet framing, CRC, serial transport, article programming, cash in/out, reports, and the general
receipt protocol are intentionally not re-analyzed here (covered in the other documents).

---

## Architecture

Storno is **not** a facade method on `Ecr`. The `Ecr` class exposes no `openVoidReceipt`,
`storno`, `cancel`, `refund`, `registerItem`, or `payment` method (verified against the full method
list of `Ecr.class`). Instead:

- The **UI panel** `FiscalReceiptPanel` owns two buttons — a normal one (`btnFiscalReceipt`) and a
  storno one (`btnStorna`, labelled `"Canceled"`).
- Pressing a button starts a **worker thread** that builds the individual command objects
  (`OpenVoidReceipt`, `ReceiptItem`, `PaymentMethod`, `CloseVoidReceipt`, …) and pushes each one
  through the generic transport method `Ecr.sendReceive(AEcrCommand)`.
- Each command object is an `AEcrCommand` subclass that knows its own `CommandsEnum` id and builds
  its own payload via `toIntList()`.

```
FiscalReceiptPanel (UI)
   ├─ btnFiscalReceipt ─► FiscalReceiptPanel$2 ─► new PrintReceiptThread(this, false)  // sale
   └─ btnStorna        ─► FiscalReceiptPanel$3 ─► new PrintReceiptThread(this, true)   // STORNO
                                                        │
                                                        ▼
                              FiscalReceiptPanel$PrintReceiptThread.run()
                                 builds command objects, calls Ecr.sendReceive(cmd) for each
                                                        │
                                                        ▼
                                       Ecr.sendReceive ─► EcrSerialPort (transport)
```

A separate pair of **test-print** buttons drives the hard-coded diagnostic thread
`ecr.threads.PrintFiscalReceiptThread(boolean voidReceipt)` (item `"?????"`, qty 1, price 1). That
thread is the cleanest single-method illustration of the exact command sequence and is used below as
the canonical skeleton.

---

## Java Classes

| Class | Package | Superclass / role |
|---|---|---|
| `OpenVoidReceipt` | `ecr.ecrcommunication.commands.fiscalreceipt` | `AEcrCommand` — opens a storno receipt |
| `CloseVoidReceipt` | `ecr.ecrcommunication.commands.fiscalreceipt` | `AEcrCommand` — closes a storno receipt |
| `CancelFiscalReceipt` | `ecr.ecrcommunication.commands.fiscalreceipt` | `AEcrCommand` — aborts an in-progress receipt (cleanup, not storno) |
| `OpenFiscalReceipt` | `ecr.ecrcommunication.commands.fiscalreceipt` | `AEcrCommand` — opens a *normal* receipt (contrast) |
| `CloseFiscalReceipt` | `ecr.ecrcommunication.commands.fiscalreceipt` | `AEcrCommand` — closes a *normal* receipt (contrast) |
| `ReceiptItem` | `ecr.ecrcommunication.commands.fiscalreceipt` | `AEcrCommand` — registers a line item (`REGISTER_SALE`); reused verbatim by storno |
| `PaymentMethod` | `ecr.ecrcommunication.commands.fiscalreceipt` | `AEcrCommand` — registers payment (`CALCULATE_TOTAL`); reused verbatim by storno |
| `AEcrCommand` | `ecr.ecrcommunication.core` | abstract base: holds `commandEnum`, `getCommandEnum()`, `setCommandEnum()`, `toIntList()` |
| `Ecr` | `ecr.ecrcommunication` | facade; only `sendReceive(AEcrCommand)` is used for storno |
| `PrintReceiptThread` | `ecr.ui.panels` (`FiscalReceiptPanel$PrintReceiptThread`) | real user-data worker; ctor arg `isCanceled` = storno flag |
| `PrintFiscalReceiptThread` | `ecr.threads` | test-print worker; ctor arg `voidReceipt` = storno flag |
| `FiscalReceiptPanel$2 / $3` | `ecr.ui.panels` | action listeners for `btnFiscalReceipt` / `btnStorna` |
| `FiscalReceiptPanel$4 / $13` | `ecr.ui.panels` | action listeners for the *test-print* normal / void buttons |

Whole-SDK reference scan confirms the storno surface is exactly these classes:

```text
grep -rlia "storno|void|cancel|refund|reverse"  →  OpenVoidReceipt, CloseVoidReceipt,
   CancelFiscalReceipt, Ecr, CommandsEnum, PrintFiscalReceiptThread, PrintFiscalReceiptsThread,
   FiscalReceiptPanel (+ inner classes), EcrConfirmationDialog (unrelated), …
```

There is **no** `Refund`, `NegativeSale`, `ReverseSale`, `Correction`, or `ReceiptCancel` command
class. "Refund/void/storno" is one mechanism: the void receipt.

---

## Commands

Command ids come from `ecr.ecrcommunication.enums.CommandsEnum` (`<init>(String name, int ordinal,
int value)`; the third int is the on-wire command id).

| CommandsEnum constant | Ordinal | Value (dec) | Value (hex) | Used by |
|---|---:|---:|---:|---|
| `OPEN_FISCAL_RECEIPT` | 17 | 48 | `0x30` | `OpenFiscalReceipt`; `OpenVoidReceipt` on **cash register** |
| `REGISTER_SALE` | 18 | 49 | `0x31` | `ReceiptItem` (sale **and** storno) |
| `CALCULATE_TOTAL` | 21 | 53 | `0x35` | `PaymentMethod` (sale **and** storno) |
| `CLOSE_FISCAL_RECEIPT` | 23 | 56 | `0x38` | `CloseFiscalReceipt`; `CloseVoidReceipt` on **cash register** |
| `CANCEL_FISCAL_RECEIPT` | 24 | 60 | `0x3C` | `CancelFiscalReceipt` (abort/cleanup) |
| `OPEN_VOID_RECEIPT` | 61 | 85 | `0x55` | `OpenVoidReceipt` on **printer** |
| `CLOSE_VOID_RECEIPT` | 62 | 86 | `0x56` | `CloseVoidReceipt` on **printer** |

Bytecode (from `CommandsEnum.<clinit>`, `bipush ordinal; bipush value; invokespecial <init>`):

```text
OPEN_FISCAL_RECEIPT    bipush 17  bipush 48
REGISTER_SALE          bipush 18  bipush 49
CALCULATE_TOTAL        bipush 21  bipush 53
CLOSE_FISCAL_RECEIPT   bipush 23  bipush 56
CANCEL_FISCAL_RECEIPT  bipush 24  bipush 60
OPEN_VOID_RECEIPT      bipush 61  bipush 85
CLOSE_VOID_RECEIPT     bipush 62  bipush 86
```

### Device-type command remapping (critical)

`OpenVoidReceipt` and `CloseVoidReceipt` change their command id **at construction time** depending
on `Constants.deviceType`:

- **PRINTER**: keep the dedicated void command id (`OPEN_VOID_RECEIPT 0x6A` / `CLOSE_VOID_RECEIPT
  0x55`). The payload is then identical to a normal open/close — the *command id* is what marks it as
  a void.
- **CASH_REGISTER**: `setCommandEnum(OPEN_FISCAL_RECEIPT / CLOSE_FISCAL_RECEIPT)` — i.e. it uses the
  **same command id as a normal receipt** (`0x2A` / `0x36`) and marks "void" through a **payload
  flag** instead.

```text
OpenVoidReceipt.<init>()
   1: getstatic CommandsEnum.OPEN_VOID_RECEIPT        ; default id = 0x6A
   4: invokespecial AEcrCommand.<init>(CommandsEnum)
   7: getstatic Constants.deviceType
  10: getstatic DeviceTypeEnum.CASH_REGISTER
  13: if_acmpne -> 23                                  ; printer? keep 0x6A
  16: getstatic CommandsEnum.OPEN_FISCAL_RECEIPT
  20: invokevirtual setCommandEnum(...)                ; cash register -> 0x2A
  23: return

CloseVoidReceipt.<init>()   ; same pattern: default CLOSE_VOID_RECEIPT 0x55,
                            ; cash register -> setCommandEnum(CLOSE_FISCAL_RECEIPT 0x36)
```

---

## Payloads

### OpenVoidReceipt vs OpenFiscalReceipt

`toIntList()` branches on device type and emits a fixed string converted to bytes by
`Utils.getIntListFromString(...)`.

| Command | PRINTER payload | CASH_REGISTER payload |
|---|---|---|
| `OpenFiscalReceipt` (normal) | `"1,0000,1"` | `"1\t1\t\t0\t"` |
| `OpenVoidReceipt` (storno) | `"1,0000,1"` | `"1\t1\t\t1\t"` |

Observations:

- On **PRINTER** the two payloads are **byte-identical** (`"1,0000,1"`). Void-ness is carried only
  by the different command id (`0x6A` vs `0x2A`). (`"1,0000,1"` = operator 1, password `0000`,
  receipt/till 1 — the standard open-receipt header.)
- On **CASH_REGISTER** both use command `0x2A`, and the **4th tab-separated field** is the storno
  flag: `0` = normal, `1` = storno. Payload `"1\t1\t\t1\t"` vs `"1\t1\t\t0\t"`.

```text
OpenVoidReceipt.toIntList()
   PRINTER branch:        ldc "1,0000,1"  -> getIntListFromString
   CASH_REGISTER branch:  ldc "1\t1\t\t1\t" -> getIntListFromString   ; 4th field '1' = storno

OpenFiscalReceipt.toIntList()
   PRINTER branch:        ldc "1,0000,1"
   CASH_REGISTER branch:  ldc "1\t1\t\t0\t"                           ; 4th field '0' = normal
```

### CloseVoidReceipt / CloseFiscalReceipt / CancelFiscalReceipt

All three carry **no payload** — `toIntList()` returns `null`. The command id alone is the whole
message.

```text
CloseVoidReceipt.toIntList()     -> aconst_null; areturn
CloseFiscalReceipt.toIntList()   -> aconst_null; areturn
CancelFiscalReceipt.toIntList()  -> aconst_null; areturn
```

(For cash register, `CloseVoidReceipt` has already been remapped to `CLOSE_FISCAL_RECEIPT 0x36`, so
the close is byte-identical to a normal close there; the void was established by the open flag.)

### ReceiptItem (storno line item) — `REGISTER_SALE 0x30`

Storno reuses `ReceiptItem` unchanged. Its printer payload is the standard sale line
`description \t [@] <vat><price>*<quantity>[correction]`, formatted with `DecimalFormat("0.00")` for
price and `DecimalFormat("0.000")` for quantity, decimal separators normalized. **Price and quantity
are the raw positive fields** — no sign flip for storno.

### PaymentMethod (storno payment) — `CALCULATE_TOTAL 0x34`

Storno reuses `PaymentMethod` unchanged. Fields: `paymentMethod` (enum: `CASH`, `CREDIT`, `CHECK`,
`DEBIT`, …), `value` (double, positive), optional `infoLine1/2`. **No negative value, no dedicated
refund method enum.**

---

## Constructors

```java
// --- OPEN ---
OpenVoidReceipt()      // id defaults to OPEN_VOID_RECEIPT (0x6A); cash register -> OPEN_FISCAL_RECEIPT (0x2A)
OpenFiscalReceipt()    // id OPEN_FISCAL_RECEIPT (0x2A)
OpenFiscalReceipt(boolean testSale)

// --- ITEM (REGISTER_SALE 0x30) ---
ReceiptItem()
ReceiptItem(String description, VatGroupEnum vat, double price, double quantity, boolean macedonianItem)
ReceiptItem(String description, VatGroupEnum vat, double price, double quantity, boolean macedonianItem,
            PriceCorrectionTypeEnum correctionType, double correctionValue)

// --- PAYMENT (CALCULATE_TOTAL 0x34) ---
PaymentMethod()                                  // defaults: CASH, value 0.0
PaymentMethod(PaymentMethodEnum method)
PaymentMethod(PaymentMethodEnum method, double value)

// --- CLOSE ---
CloseVoidReceipt()     // id defaults to CLOSE_VOID_RECEIPT (0x55); cash register -> CLOSE_FISCAL_RECEIPT (0x36)
CloseFiscalReceipt()   // id CLOSE_FISCAL_RECEIPT (0x36)

// --- ABORT / CLEANUP ---
CancelFiscalReceipt()  // id CANCEL_FISCAL_RECEIPT (0x38)
```

**Every one of these constructors is parameterless with respect to any original-receipt reference.**
The 5th boolean of `ReceiptItem` is `macedonianItem` (Cyrillic-encoding flag), *not* a storno flag.
Searched all constructors and payload builders for: original fiscal number, fiscal slip number,
document number, receipt number, reference number, original invoice — **none exist**.

---

## Workflow

### Canonical sequence (from `PrintFiscalReceiptThread.run()`, the diagnostic thread)

`voidReceipt` is the storno flag. The sequence:

```
[pre-clean / reset device state — results ignored]
   PaymentMethod(CASH)        ─► sendReceive   (flush any pending total)
   CloseFiscalReceipt()       ─► sendReceive
   CloseVoidReceipt()         ─► sendReceive
   CancelFiscalReceipt()      ─► sendReceive
        │
        ▼
   if (voidReceipt)  OpenVoidReceipt()   else  OpenFiscalReceipt()   ─► sendReceive
        │
        ▼
   ReceiptItem("…", VAT_A, qty, price, mac=true)   ─► sendReceive
   ReceiptItem("…", VAT_A, qty, price, mac=false)  ─► sendReceive
   ReceiptItem("…", VAT_G, qty, price, mac=false)  ─► sendReceive
        │
        ▼
   PaymentMethod(); setPaymentMethod(CASH)         ─► sendReceive   (twice)
        │
        ▼
   if (voidReceipt)  CloseVoidReceipt()  else  CloseFiscalReceipt()  ─► sendReceive
```

### Diagram

```
        ┌──────────── pre-clean (defensive, results popped) ────────────┐
        │  PaymentMethod(CASH) → CloseFiscal → CloseVoid → CancelFiscal  │
        └───────────────────────────────────────────────────────────────┘
                                   │
                storno?  ──yes──►  OPEN VOID  RECEIPT  (0x6A / cash-reg 0x2A flag=1)
                   │       no ──►  OPEN FISCAL RECEIPT (0x2A / cash-reg flag=0)
                   ▼
                REGISTER ITEM (REGISTER_SALE 0x30)   ── positive price & qty
                   ▼
                REGISTER ITEM …                       (1..N items, N≤8 in real UI)
                   ▼
                PAYMENT (CALCULATE_TOTAL 0x34)        ── positive value, per method
                   ▼
                storno?  ──yes──►  CLOSE VOID  RECEIPT  (0x55 / cash-reg 0x36)
                   │       no ──►  CLOSE FISCAL RECEIPT (0x36)
                   ▼
                 done  (Mainframe.enableFields())
```

The real user thread `PrintReceiptThread.run()` follows the **same** open→items→payment→close shape,
minus the pre-clean block, reading up to **8 items** and **multiple payment methods** from the UI.

---

## UI flow

`ecr.ui.panels.FiscalReceiptPanel` creates two receipt buttons:

| Field | Button label | Listener | Thread started | Storno? |
|---|---|---|---|---|
| `btnFiscalReceipt` | (Cyrillic, mangled) | `FiscalReceiptPanel$2` | `new PrintReceiptThread(this, false)` | No |
| `btnStorna` | `"Canceled"` | `FiscalReceiptPanel$3` | `new PrintReceiptThread(this, true)` | **Yes** |

Bytecode (button creation in `FiscalReceiptPanel`):

```text
355: new JButton
359: ldc "Canceled"
361: invokespecial JButton.<init>(String)
364: putfield FiscalReceiptPanel.btnStorna
371: new FiscalReceiptPanel$3
376: invokespecial FiscalReceiptPanel$3.<init>(FiscalReceiptPanel)
    ...addActionListener
```

Bytecode (`FiscalReceiptPanel$3.actionPerformed`, the storno button):

```text
 6: new  FiscalReceiptPanel$PrintReceiptThread
14: iconst_1                                    ; isCanceled = true  → STORNO
15: invokespecial PrintReceiptThread.<init>(FiscalReceiptPanel, Z)
20: invokevirtual PrintReceiptThread.start()
```

`FiscalReceiptPanel$2` is identical but `iconst_0` (normal sale).

The **test-print** buttons are wired the same way to the diagnostic thread:

- `FiscalReceiptPanel$4.actionPerformed` → `new PrintFiscalReceiptThread(false)` (test normal)
- `FiscalReceiptPanel$13.actionPerformed` → `new PrintFiscalReceiptThread(true)` (test storno)

There is **no confirmation dialog** in front of the storno button — `actionPerformed` disables the
buttons and immediately starts the worker thread. (`EcrConfirmationDialog` exists in the SDK but is
not referenced by any fiscal-receipt/storno class.)

### `PrintReceiptThread` open / item / close bytecode (real thread)

```text
; OPEN — choose command by isCanceled
2044: getfield PrintReceiptThread.isCanceled
2047: ifeq -> 2062
2050: new OpenVoidReceipt ; <init> ; astore 97          ; storno
2059: goto -> 2071
2062: new OpenFiscalReceipt ; <init> ; astore 97        ; normal
2071: Ecr.sendReceive(or) ; pop

; ITEMS — up to 8, each gated by an "item enabled" boolean (iload 41..48)
2085: ifeq (skip item 1)
2088: new ReceiptItem ; <init>(String,VatGroupEnum,DDZ,PriceCorrectionTypeEnum,D) ; astore 98
2121: Ecr.sendReceive(ri) ; pop
   … repeated for items 2..8 …

; PAYMENTS — each gated by (value > 0.0): CASH, CREDIT, CHECK, DEBIT, …
2637: new PaymentMethod ; setPaymentMethod(CREDIT) ; setValue(dload 91) ; sendReceive ; pop
2677: new PaymentMethod ; setPaymentMethod(CHECK)  ; setValue(dload 93) ; sendReceive ; pop
2717: new PaymentMethod ; setPaymentMethod(DEBIT)  ; setValue(dload 95) ; sendReceive ; pop

; CLOSE — choose command by isCanceled
2754: getfield PrintReceiptThread.isCanceled
2757: ifeq -> 2772
2760: new CloseVoidReceipt ; <init> ; astore 99         ; storno
2769: goto -> 2781
2772: new CloseFiscalReceipt ; <init> ; astore 99       ; normal
2781: Ecr.sendReceive(cr) ; pop
```

---

## Response handling

**At the storno-workflow level, responses are ignored.** Every `Ecr.sendReceive(...)` call in both
the diagnostic thread and the real `PrintReceiptThread` is immediately followed by `pop` — the
returned `EcrResponse` is discarded. Verified: `PrintFiscalReceiptThread` has 22 `sendReceive` calls
and 22 matching `pop`s.

Consequences:

- Java does **not** inspect a per-command `P` / `F` / `OK` result during the storno sequence. It does
  not branch on whether OPEN, each ITEM, PAYMENT, or CLOSE individually succeeded.
- The only thing that can interrupt the sequence is an **exception** thrown from inside
  `sendReceive` (e.g. transport/offline error). That is caught by the thread's outer
  `try/catch`.
- Packet-level `OK`/`P`/`F` interpretation lives *inside* `Ecr.sendReceive` → `EcrSerialPort`
  (the receipt/serial protocol, already analyzed). The storno workflow does not add any response
  logic on top of it.

So the answer to "what does Java expect after every storno command — P/F/OK/Error?" is: **the storno
threads expect nothing and check nothing** beyond "the call returned without throwing". There is no
`P`/`F` gate, no success assertion, no per-step retry.

---

## Recovery

Error handling is coarse and differs between the two threads.

### Diagnostic thread `PrintFiscalReceiptThread.run()`

- **Pre-emptive cleanup** *before* opening: it fires `PaymentMethod(CASH)`, `CloseFiscalReceipt`,
  `CloseVoidReceipt`, `CancelFiscalReceipt` (results ignored) to force the device out of any
  half-open receipt state left by a previous failure. This is the closest thing to "recovery": a
  best-effort reset at the **start**, not the end.
- `try { …whole sequence… } catch (Exception e) { APPLICATION_LOGGER.error(...); }
  finally { MAIN_FRAME.enableFields(); }`.
- No automatic cancel of the *current* receipt on mid-sequence failure, no retry, no reopen.

```text
PrintFiscalReceiptThread.run()  (start)
   PaymentMethod(CASH)   → sendReceive → pop
   CloseFiscalReceipt()  → sendReceive → pop
   CloseVoidReceipt()    → sendReceive → pop
   CancelFiscalReceipt() → sendReceive → pop
   … then open/items/payment/close …
catch Exception -> log ; finally -> enableFields
```

### Real thread `PrintReceiptThread.run()`

- **No pre-clean block.** It goes straight to open→items→payment→close.
- `try { … } catch (Exception e) { APPLICATION_LOGGER.error(e); JOptionPane "…"+e.getMessage() }
  finally { MAIN_FRAME.enableFields(); }`.
- On a validation failure it shows a message dialog (`"?????? ??????? ???????"` / `"????????
  ?????????"`, Cyrillic mangled) and stops.
- **No automatic `CancelFiscalReceipt`, no retry, no reopen, no rollback.** If the device is left with
  a half-open void receipt, cleanup only happens the *next* time the diagnostic test-print thread
  runs its pre-clean block, or by manual operator action.

Summary: **Java does not auto-cancel, does not retry, does not reopen, does not recover** the storno
transaction itself. It logs and surfaces a dialog; device-state hygiene relies on the *next*
operation's pre-clean.

---

## Validation

Validation is entirely in `ReceiptItem`; the open/close/void commands validate nothing.

| Validator | Rule | Failure |
|---|---|---|
| `ValidateDescription()` | description must be non-null; on PRINTER, truncated to ~19–20 chars | throws `Exception("Description field must not be NULL")` |
| `ValidatePrice()` | `price >= 0` | throws `Exception("Price must be greater then 0")` |
| `ValidateQuantity()` | `quantity >= 0` | throws `Exception("Quantity must be greater then 0")` |
| `ValidateVatGroup()` | vatGroup non-null | throws `Exception("Vat Group was not assigned")` |
| `ValidateItem()` | calls all four above | first failure propagates |

`ValidateItem()` is invoked at the top of `ReceiptItem.toIntList()`; if it returns false the payload
is empty.

```text
ValidatePrice()      : getfield price ; dconst_0 ; dcmpg ; ifge OK ; else throw "Price must be greater then 0"
ValidateQuantity()   : getfield quantity ; dconst_0 ; dcmpg ; ifge OK ; else throw "Quantity must be greater then 0"
```

Implications for storno capability:

- **Full vs partial storno:** The workflow can register **any subset of items with any positive
  quantity/price** inside the void receipt — so both a full reversal (all original lines re-entered)
  and a partial reversal (some lines / reduced quantity) are *mechanically possible*. Nothing in the
  code ties the storno to the original receipt's line set.
- **Quantity validation:** only `quantity >= 0` (must be non-negative). No check that it matches an
  original sold quantity.
- **Price validation:** only `price >= 0`. No check against an original price.
- **Reference validation:** **none.** There is no original-receipt reference to validate.

So: storno correctness (that the void matches a real prior sale) is **not enforced by Java** — it is
the operator's/firmware's responsibility. Java simply prints a void receipt for whatever positive
lines are entered.

---

## Bytecode evidence (index)

- `OpenVoidReceipt.<init>` / `.toIntList` — command remap to `OPEN_FISCAL_RECEIPT` on cash register;
  payloads `"1,0000,1"` (printer) and `"1\t1\t\t1\t"` (cash register). *(storno-commands.txt)*
- `CloseVoidReceipt.<init>` / `.toIntList` — remap to `CLOSE_FISCAL_RECEIPT` on cash register; null
  payload. *(storno-commands.txt)*
- `CancelFiscalReceipt.<init>` / `.toIntList` — `CANCEL_FISCAL_RECEIPT 0x38`; null payload.
- `CommandsEnum.<clinit>` — command ids table above.
- `ReceiptItem` — `REGISTER_SALE`; ctor field assignments; `ValidatePrice`/`ValidateQuantity`
  non-negative gates; `toIntList` sale-line format. *(storno-item-payment.txt)*
- `PaymentMethod` — `CALCULATE_TOTAL`; positive `value`. *(storno-item-payment.txt)*
- `PrintFiscalReceiptThread.run` — canonical open/items/payment/close with `voidReceipt` branch and
  pre-clean block; all responses popped. *(storno-threads.txt)*
- `PrintReceiptThread.run` — real 8-item / multi-payment version; `isCanceled` branch at open (pc
  2044) and close (pc 2754). *(storno-ui.txt)*
- `FiscalReceiptPanel` — `btnStorna` = `"Canceled"`, wired to `$3` → `PrintReceiptThread(true)`.
  *(storno-panel-main.txt / storno-buttons.txt)*

---

## Java pseudocode

```java
// ---------- command objects ----------
class OpenVoidReceipt extends AEcrCommand {
    OpenVoidReceipt() {
        super(CommandsEnum.OPEN_VOID_RECEIPT);                 // 0x6A
        if (Constants.deviceType == DeviceTypeEnum.CASH_REGISTER)
            setCommandEnum(CommandsEnum.OPEN_FISCAL_RECEIPT);  // 0x2A + flag payload
    }
    List<Integer> toIntList() {
        if (deviceType == PRINTER)       return bytesOf("1,0000,1");
        if (deviceType == CASH_REGISTER) return bytesOf("1\t1\t\t1\t"); // 4th field 1 = storno
        return null;
    }
}

class CloseVoidReceipt extends AEcrCommand {
    CloseVoidReceipt() {
        super(CommandsEnum.CLOSE_VOID_RECEIPT);                // 0x55
        if (deviceType == CASH_REGISTER)
            setCommandEnum(CommandsEnum.CLOSE_FISCAL_RECEIPT); // 0x36
    }
    List<Integer> toIntList() { return null; }
}

class CancelFiscalReceipt extends AEcrCommand {
    CancelFiscalReceipt() { super(CommandsEnum.CANCEL_FISCAL_RECEIPT); } // 0x38
    List<Integer> toIntList() { return null; }
}

// ---------- worker (storno == same shape as sale) ----------
void run(boolean isCanceled) {
    try {
        AEcrCommand open = isCanceled ? new OpenVoidReceipt() : new OpenFiscalReceipt();
        Constants.ECR.sendReceive(open);                        // response ignored

        for (Item it : enabledItems)                            // positive price & qty only
            Constants.ECR.sendReceive(new ReceiptItem(
                it.desc, it.vat, it.price, it.qty, it.macedonian,
                it.correctionType, it.correctionValue));

        for (Payment p : payments) if (p.value > 0) {           // positive amounts only
            PaymentMethod pm = new PaymentMethod();
            pm.setPaymentMethod(p.method);                      // CASH/CREDIT/CHECK/DEBIT
            pm.setValue(p.value);
            Constants.ECR.sendReceive(pm);
        }

        AEcrCommand close = isCanceled ? new CloseVoidReceipt() : new CloseFiscalReceipt();
        Constants.ECR.sendReceive(close);                       // response ignored
    } catch (Exception e) {
        APPLICATION_LOGGER.error(e);
        JOptionPane.showMessageDialog(MAIN_FRAME, e.getMessage(), "Error", 0);
        // no cancel, no retry, no reopen
    } finally {
        MAIN_FRAME.enableFields();
    }
}
```

---

## Examples

### Example 1 — Storno of 2 items on a **PRINTER**

```
→ OPEN_VOID_RECEIPT   (0x6A)   payload "1,0000,1"
→ REGISTER_SALE       (0x30)   "Bread\tА12,00*1,000"      (positive)
→ REGISTER_SALE       (0x30)   "Milk\tА30,00*2,000"       (positive)
→ CALCULATE_TOTAL     (0x34)   CASH, value=0 (full)        (positive)
→ CLOSE_VOID_RECEIPT  (0x55)
```

### Example 2 — Same storno on a **CASH REGISTER**

```
→ OPEN_FISCAL_RECEIPT (0x2A)   payload "1\t1\t\t1\t"   ← flag 1 = storno
→ REGISTER_SALE       (0x30)   item line (positive)
→ REGISTER_SALE       (0x30)   item line (positive)
→ CALCULATE_TOTAL     (0x34)   CASH (positive)
→ CLOSE_FISCAL_RECEIPT(0x36)                           ← void was set by the open flag
```

### Example 3 — Normal sale (contrast)

```
PRINTER:        OPEN_FISCAL_RECEIPT 0x2A "1,0000,1"  … CLOSE_FISCAL_RECEIPT 0x36
CASH_REGISTER:  OPEN_FISCAL_RECEIPT 0x2A "1\t1\t\t0\t"  … CLOSE_FISCAL_RECEIPT 0x36
```

The **only** deltas from Example 1/2 are the OPEN command id / open flag and the CLOSE command id.

---

## UNKNOWN section

| Question | Status |
|---|---|
| Exact meaning of every field in printer open payload `"1,0000,1"` | PARTIAL. Structurally operator `1`, password `0000`, till/receipt-type `1` (matches normal open). Firmware-side exact semantics not proven from bytecode. |
| Exact meaning of cash-register open fields `"1\t1\t\t1\t"` beyond the storno flag | PARTIAL. 4th field `0/1` is proven to be normal/storno; the empty 3rd field and trailing tab are format placeholders whose firmware meaning isn't in the SDK. |
| Does firmware require the storno's items/amounts to match a real prior sale? | UNKNOWN. Java performs no such check; any enforcement is firmware-side. |
| Printed Cyrillic labels of the real storno button and dialogs | UNKNOWN. Stored mangled as `?` in the class file; the Latin field name `btnStorna` and label `"Canceled"` are recoverable, Cyrillic UI text is not. |
| Whether `P`/`F`/`OK` is enforced anywhere for storno | Proven NOT at the workflow level (responses popped). Any packet-level `OK`/`P`/`F` handling is inside `EcrSerialPort.sendReceive` (serial/receipt protocol, analyzed separately). |
| Why the diagnostic thread sends `PaymentMethod(CASH)` twice | UNKNOWN. Bytecode shows two consecutive `sendReceive(pm)`; likely a quirk/relic. Not present in the real thread. |
| Time limits / same-day constraints on storno | UNKNOWN. Not represented in the SDK; firmware/regulatory concern. |

---

## Final conclusion

1. **Storno = void fiscal receipt.** It is a full receipt (open → items → payment → close) opened and
   closed with *void* command variants. There is no dedicated refund/negative-sale/correction
   command.
2. **No original-receipt reference exists anywhere** in the storno constructors or payloads — no
   fiscal number, document number, receipt number, invoice reference, or correlation field. This is
   the defining characteristic to replicate (or deliberately change) in FiscalBridge.
3. **Items and payments are re-entered as positive values** using the *same* `ReceiptItem`
   (`REGISTER_SALE 0x30`) and `PaymentMethod` (`CALCULATE_TOTAL 0x34`) commands as a normal sale.
   `ReceiptItem` validators actively **reject** negative price/quantity.
4. **Device-type dispatch:**
   - PRINTER: `OPEN_VOID_RECEIPT 0x6A` / `CLOSE_VOID_RECEIPT 0x55`, same open payload as a sale.
   - CASH_REGISTER: reuses `OPEN_FISCAL_RECEIPT 0x2A` / `CLOSE_FISCAL_RECEIPT 0x36`, with the storno
     marked by the open-payload flag (`"1\t1\t\t1\t"`, 4th field `1`).
5. **UI:** `FiscalReceiptPanel.btnStorna` ("Canceled") → `FiscalReceiptPanel$3` →
   `new PrintReceiptThread(this, true)`; the boolean field `isCanceled` selects the void open/close
   at runtime. No confirmation dialog gates it.
6. **Response handling:** the workflow ignores every command's response (all `pop`ped). It does not
   test `P`/`F`/`OK` per step. Only a thrown transport exception interrupts the flow.
7. **Recovery:** none for the in-flight storno — no auto-cancel, no retry, no reopen. Best-effort
   device reset (`Close*/Cancel`) happens only as a *pre-clean* at the start of the diagnostic
   test-print thread; the real thread just logs + shows a dialog on error.

Bottom line for FiscalBridge: to reproduce Java's behavior, a storno endpoint must open in void mode
(command id on printer, payload flag on cash register), register the lines as normal positive
`REGISTER_SALE` items, take normal positive `CALCULATE_TOTAL` payments, and close in void mode — with
**no** original-receipt reference and **no** per-command response gating. If FiscalBridge needs
original-receipt linkage, quantity/price cross-checks, or per-step `P`/`F` verification, those are
**additions beyond** the original Java implementation, not ports of it.
