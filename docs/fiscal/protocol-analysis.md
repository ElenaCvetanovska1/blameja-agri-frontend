# Protocol Packet Analysis

Scope: this document analyzes byte-level request/response framing visible in `Ecr-1.7.739.jar`. It does not analyze fiscal business-command payload semantics.

Primary methods:

- `ecr.ecrcommunication.EcrSerialPort.packageCommand(AEcrCommand command, boolean repeatCommand)`
- `ecr.ecrcommunication.EcrSerialPort.writeAndRead(AEcrCommand command, boolean repeatCommand)`
- `ecr.ecrcommunication.EcrSerialPort.readFromSerialPort(AEcrCommand command)`
- `ecr.ecrcommunication.core.AEcrCommand`
- `ecr.ecrcommunication.enums.CommandsEnum`
- `ecr.utils.Utils.getDataFromMessage(List)`
- `ecr.utils.Utils.getStatusFromMessage(List)`

## Request Packet Format

Class/method: `ecr.ecrcommunication.EcrSerialPort.packageCommand(AEcrCommand command, boolean repeatCommand)`

Observed request layout:

```text
index  meaning
-----  ---------------------------------------------
0      start byte: 1
1      length byte: 36 + payloadLength
2      sequence byte: command.sequenceCode
3      command ID byte: command.getCommandEnum().getValue()
4..n   payload bytes from command.toIntList(), if non-null
n+1    separator/checksum-prefix byte: 5
n+2    checksum char 1
n+3    checksum char 2
n+4    checksum char 3
n+5    checksum char 4
n+6    end byte: 3
```

The packet is returned as `List<Integer>`. `writeAndRead(...)` later writes each element masked with `0xFF`.

### 1. Start Byte / Prefix Byte

Class/method: `EcrSerialPort.packageCommand(...)`

The first request byte is literal `1`.

```text
38: aload_3
39: iconst_1
40: invokestatic Integer.valueOf(int)
43: invokeinterface List.add(Object)
```

### 2. Sequence Byte Behavior

Class/method: `EcrSerialPort.packageCommand(...)`

If `repeatCommand` is true, the command receives a new sequence code from `Globals.getSequenceCode()`:

```text
68: iload_2
69: ifeq 79
72: aload_1
73: invokestatic ecr/utils/Globals.getSequenceCode()
76: invokevirtual AEcrCommand.setSequenceCode(int)
```

The command sequence code is then set to its own current value and appended:

```text
79: aload_1
80: aload_1
81: invokevirtual AEcrCommand.getSequenceCode()
84: invokevirtual AEcrCommand.setSequenceCode(int)
87: aload_3
88: aload_1
89: invokevirtual AEcrCommand.getSequenceCode()
95: List.add(Integer.valueOf(sequenceCode))
```

Class/method: `ecr.utils.Globals.getSequenceCode()`

The global sequence increments by one, wraps to `33` after `127`, and returns the result.

```text
0: getstatic Globals.seq
3: iconst_1
4: iadd
5: putstatic Globals.seq
8: getstatic Globals.seq
11: bipush 127
13: if_icmple 21
16: bipush 33
18: putstatic Globals.seq
21: getstatic Globals.seq
24: ireturn
```

### 3. Length Byte Behavior

Class/method: `EcrSerialPort.packageCommand(...)`

The local length starts at `36` (`0x24`). If payload exists, payload size is added. This value is appended as byte index `1`.

```text
8:  bipush 36
10: istore length
15: command.toIntList()
21: if payload == null -> 38
26: length += payload.size()
49: aload_3
50: iload length
55: List.add(Integer.valueOf(length))
```

Important: the code does not compute actual Java list size. It computes `36 + payloadLength`.

### 4. Command ID Byte Position

Class/method: `EcrSerialPort.packageCommand(...)`

The command ID is byte index `3`, immediately after start, length, and sequence.

```text
110: aload_3
111: aload_1
112: invokevirtual AEcrCommand.getCommandEnum()
115: invokevirtual CommandsEnum.getValue()
121: List.add(Integer.valueOf(commandValue))
```

### 5. Payload/Data Position

Class/method: `EcrSerialPort.packageCommand(...)`

Payload comes from `command.toIntList()`. If non-null, every integer is appended after the command ID, starting at index `4`.

```text
139: payload ifnull -> 197
144: payload.iterator()
163: iterator.next()
175: request.add(payloadByte)
184: checksum += payloadByte.intValue()
```

Class/method: `ecr.ecrcommunication.core.AEcrCommand`

The base class declares `toIntList()`, but no bytecode body was visible in the base class output. Concrete command classes provide payload data. This document does not analyze those business-command payloads.

### 6. Checksum/LRC/CRC Algorithm

Class/method: `EcrSerialPort.packageCommand(...)`

The checksum is an additive sum, not a visible CRC/XOR/LRC helper call.

Observed sum inputs:

1. length byte
2. sequence byte
3. command ID byte
4. each payload byte, if any
5. literal `5`

Bytecode evidence:

```text
61: checksum += length
101: checksum += command.getSequenceCode()
127: checksum += command.getCommandEnum().getValue()
184: checksum += payloadByte.intValue()
197: iinc checksum by 5
200: request.add(5)
```

Four checksum bytes are then appended. They are generated from the sum as four nibbles converted by adding ASCII `48` (`'0'`):

```text
211: checksum / 256 / 16 + 48
233: checksum / 256 % 16 + 48
255: checksum % 256 / 16 + 48
277: checksum % 256 % 16 + 48
```

Equivalent pseudocode:

```text
sum = length + sequence + commandId + sum(payloadBytes) + 5

c1 = ((sum / 256) / 16) + 48
c2 = ((sum / 256) % 16) + 48
c3 = ((sum % 256) / 16) + 48
c4 = ((sum % 256) % 16) + 48
```

Important: the bytecode always adds `48`; it does not visibly convert values `10..15` to ASCII `A..F`.

Utility note:

- The string `chksum` appears in `ecr.utils.Utils` constants, but no callable `Utils.chksum(...)` method appears in the method table.
- `EcrSerialPort.packageCommand(...)` computes the checksum inline.

### 7. End Byte

Class/method: `EcrSerialPort.packageCommand(...)`

The final request byte is literal `3`.

```text
299: aload_3
300: iconst_3
304: List.add(Integer.valueOf(3))
310: areturn
```

### 8. Whether repeatCommand Changes the Packet

Class/method: `EcrSerialPort.packageCommand(...)`

Yes. `repeatCommand` controls whether a new sequence byte is assigned.

- If `repeatCommand == true`, `Globals.getSequenceCode()` is called and the command sequence changes.
- If `repeatCommand == false`, the existing `command.sequenceCode` is reused.

Class/method: `EcrSerialPort.sendReceiveCommand(...)`

The first attempt sets `repeatCommand` to `true`; retries set it to `false`.

```text
20: iconst_1
21: istore repeatCommand
37: writeAndRead(command, repeatCommand)
140: iconst_0
141: istore repeatCommand
```

### 9. How command.sequenceCode Is Assigned or Incremented

Class/method: `ecr.utils.Globals.getSequenceCode()`

Sequence behavior:

```text
seq = seq + 1
if (seq > 127) seq = 33
return seq
```

Class/method: `EcrSerialPort.packageCommand(...)`

Assignment happens only when `repeatCommand` is true:

```text
if (repeatCommand) {
    command.setSequenceCode(Globals.getSequenceCode());
}
```

### 10. How command.toIntList() Is Appended

Class/method: `EcrSerialPort.packageCommand(...)`

The payload list is obtained before packet construction:

```text
15: command.toIntList()
19: astore payload
```

If non-null:

```text
144: payload.iterator()
163: iterator.next()
175: request.add(payloadByte)
184: checksum += payloadByte.intValue()
```

Payload bytes start at request index `4`.

### 11. Request Packet Pseudocode

Class/method represented: `EcrSerialPort.packageCommand(AEcrCommand command, boolean repeatCommand)`

```text
function packageCommand(command, repeatCommand):
    packet = []
    length = 36
    checksum = 0
    payload = command.toIntList()

    if payload != null:
        length = length + payload.size()

    packet.add(1)
    packet.add(length)
    checksum += length

    if repeatCommand:
        command.setSequenceCode(Globals.getSequenceCode())

    command.setSequenceCode(command.getSequenceCode())
    packet.add(command.getSequenceCode())
    checksum += command.getSequenceCode()

    commandId = command.getCommandEnum().getValue()
    packet.add(commandId)
    checksum += commandId

    if payload != null:
        for b in payload:
            packet.add(b)
            checksum += b

    checksum += 5
    packet.add(5)

    packet.add(((checksum / 256) / 16) + 48)
    packet.add(((checksum / 256) % 16) + 48)
    packet.add(((checksum % 256) / 16) + 48)
    packet.add(((checksum % 256) % 16) + 48)

    packet.add(3)
    return packet
```

## Writing the Request

Class/method: `ecr.ecrcommunication.EcrSerialPort.writeAndRead(AEcrCommand command, boolean repeatCommand)`

`writeAndRead(...)` calls `packageCommand(...)`, logs the request, writes every packet integer with `SerialPort.writeInt(...)`, sleeps for `10 ms`, then calls `readFromSerialPort(...)`.

```text
15: packageCommand(command, repeatCommand)
86: getfield serialPort
90: packet
94: List.get(i)
102: Integer.intValue()
105: sipush 255
108: iand
109: invokevirtual jssc/SerialPort.writeInt(int)
119: ldc2_w 10
122: Thread.sleep(long)
130: readFromSerialPort(command)
```

## Response Packet Format

Class/method: `ecr.ecrcommunication.EcrSerialPort.readFromSerialPort(AEcrCommand command)`

The response parser is stream-oriented. It reads arrays from `readBytes()`, scans each integer, starts a message on byte `1`, appends bytes until byte `3`, and then marks the response `OK` before extracting data/status.

Observed response markers:

```text
byte 1  -> start response
byte 21 -> NAK
byte 22 -> SYN
byte 3  -> end response, but only after byte 1 started a message
```

Switch evidence:

```text
83: lookupswitch default->249 1->207 21->116 22->172
```

### 1. Which Byte Marks Response Start

Class/method: `EcrSerialPort.readFromSerialPort(...)`

Byte `1` marks response start.

Behavior:

1. Resets garbage counter.
2. Marks that parser is inside a message.
3. Creates/clears response list.
4. Adds byte `1` to the response list.

```text
207: iconst_0
208: istore garbageCounter
210: iconst_1
211: istore insideMessage
217: new ArrayList
225: responseList.clear()
231: responseList.add(currentByte)
```

### 2. How Response Length Is Determined

Class/method: `EcrSerialPort.readFromSerialPort(...)`

The parser does not visibly use a length byte to determine when to stop reading. It stops when byte `3` is encountered while inside a message.

Class/method: `ecr.utils.Utils.getDataFromMessage(List message)`

After a complete message is collected, data length is derived from total message size:

```text
2:  message.size()
8:  bipush 17
10: if_icmplt return null
21: message.size()
27: bipush 17
29: isub
30: dataLength = message.size() - 17
```

Conclusion:

- The byte at response index `1` is present in the collected message, but no validation/use of it was visible in the inspected methods.
- Effective data length is computed as `message.size() - 17`.

### 3. Where Response Command ID Is Located

Class/method: `EcrSerialPort.readFromSerialPort(...)`

The response command ID is read from response index `3`.

```text
264: responseList
265: iconst_3
266: List.get(3)
274: Integer.intValue()
277: command.getCommandEnum()
281: CommandsEnum.getValue()
284: if_icmpeq ok
```

### 4. How Response Command Is Validated Against the Request Command

Class/method: `EcrSerialPort.readFromSerialPort(...)`

When at least four bytes have been collected, response byte index `3` is compared to `command.getCommandEnum().getValue()`.

If not equal:

```text
287: iconst_1
288: mark done
290: setResult(EcrResponseEnum.WRONG_COMMAND_RESPONSE)
297: setResponseBytes(null)
302: log "WRONG_COMMAND_RESPONSE [Expected: ..."
```

### 5. Where Status Bytes Are Located

Class/method: `ecr.utils.Utils.getStatusFromMessage(List message)`

Status bytes are extracted only when `message.size() >= 17`.

Computation:

```text
dataLength = message.size() - 17
for i in 0..5:
    status.add(message.get(i + dataLength + 5))
```

Therefore status bytes are at:

```text
indices: dataLength + 5 through dataLength + 10
```

Since `dataLength = message.size() - 17`, this is also:

```text
indices: message.size() - 12 through message.size() - 7
```

### 6. Where Data Bytes Are Located

Class/method: `ecr.utils.Utils.getDataFromMessage(List message)`

Data bytes are extracted only when `message.size() >= 17`.

Computation:

```text
dataLength = message.size() - 17
for i in 0..dataLength-1:
    data.add(message.get(i + 4))
```

Therefore data bytes are at:

```text
indices: 4 through dataLength + 3
```

### 7. Where Checksum Is Located

Class/method: `EcrSerialPort.readFromSerialPort(...)`

Checksum location is `UNKNOWN` from validation code, because no checksum-validation logic was visible.

Inferred only from `Utils.getDataFromMessage(...)` and `Utils.getStatusFromMessage(...)`, response bytes outside data/status remain unclassified by these helpers:

```text
0                         start byte
1                         UNKNOWN / likely length byte, not validated here
2                         UNKNOWN / likely sequence byte, not validated here
3                         command ID
4..dataLength+3           data
dataLength+4              UNKNOWN
dataLength+5..+10         status bytes
dataLength+11..end        UNKNOWN in inspected helper methods
```

Do not treat that as a complete checksum map; the exact response checksum position is not proven by inspected code.

### 8. How Checksum Is Validated

Class/method: `EcrSerialPort.readFromSerialPort(...)`

No checksum validation was visible. The method:

- validates response command ID at index `3`
- extracts data/status after seeing byte `3`
- evaluates status bits
- does not visibly recompute or compare the four request-style checksum bytes

Conclusion: response checksum validation is `UNKNOWN` / not visible in inspected bytecode.

### 9. How NAK Byte 21 Is Handled

Class/method: `EcrSerialPort.readFromSerialPort(...)`

Byte `21` routes to the NAK branch.

Normal behavior:

```text
116: log "NAK received!!!"
159: mark done
162: setResult(EcrResponseEnum.NAK_RECEIVED)
169: return path
```

Special visible case:

If already inside a message and request command is `CommandsEnum.READ_SETTINGS_PRINTER`, byte `21` is appended to the response list and processing continues.

```text
126: if not insideMessage -> normal NAK
132: command.getCommandEnum()
135: CommandsEnum.READ_SETTINGS_PRINTER
141: responseList.add(currentByte)
156: goto SYN/continue branch
```

Purpose of this special case: `UNKNOWN`.

### 10. How SYN Byte 22 Is Handled

Class/method: `EcrSerialPort.readFromSerialPort(...)`

Byte `22` routes to the SYN branch.

Behavior:

1. Increments a SYN counter.
2. If counter exceeds `19`, resets counter and prints `20 x syn`.
3. Sleeps for `10 ms`.
4. Continues scanning/reading.

```text
172: iinc synCounter by 1
177: bipush 19
179: if_icmple continue
182: iconst_0
183: reset synCounter
185: System.out
188: ldc "20 x syn"
190: println
193: Thread.sleep(10)
199: continue
```

### 11. How Byte 1 Is Handled

Class/method: `EcrSerialPort.readFromSerialPort(...)`

Byte `1` starts a fresh response message:

```text
207: garbageCounter = 0
210: insideMessage = true
217: if responseList == null, new ArrayList
225: responseList.clear()
231: responseList.add(1)
```

This means a new byte `1` clears any partially collected response and starts over.

### 12. What Makes Response OK

Class/method: `EcrSerialPort.readFromSerialPort(...)`

When parser is inside a message and byte `3` is read:

1. Marks parsing done.
2. Logs the response.
3. Sets result to `EcrResponseEnum.OK`.
4. Sets response bytes.
5. Sets data via `Utils.getDataFromMessage(...)`.
6. Sets status via `Utils.getStatusFromMessage(...)`.

```text
424: currentByte
429: iconst_3
430: if_icmpne continue
433: mark done
436: log "Response [...]"
483: setResult(EcrResponseEnum.OK)
490: setResponseBytes(responseList)
495: setData(Utils.getDataFromMessage(responseList))
503: setStatus(Utils.getStatusFromMessage(responseList))
```

Important: result can later be changed to `GENERAL_ERROR` after status-bit checks.

### 13. What Makes Response WRONG_COMMAND_RESPONSE

Class/method: `EcrSerialPort.readFromSerialPort(...)`

If response index `3` does not equal `command.getCommandEnum().getValue()`, result becomes `WRONG_COMMAND_RESPONSE` and response bytes are nulled.

```text
264: responseList.get(3)
277: command.getCommandEnum()
281: CommandsEnum.getValue()
284: if_icmpeq continue
290: setResult(EcrResponseEnum.WRONG_COMMAND_RESPONSE)
297: setResponseBytes(null)
```

### 14. What Makes Response INVALID_RESPONSE

Class/method: `EcrSerialPort.readFromSerialPort(...)`

If bytes arrive before a start byte `1`, the parser increments a garbage counter. When it reaches `1000`, response result becomes `INVALID_RESPONSE`.

```text
727: iinc garbageCounter by 1
730: iload garbageCounter
732: sipush 1000
735: if_icmplt continue
738: log "garbage - invalid response"
748: mark done
751: setResult(EcrResponseEnum.INVALID_RESPONSE)
```

### 15. What Makes Response GENERAL_ERROR

Class/method: `EcrSerialPort.readFromSerialPort(...)`

After an OK response with exactly six status bytes, the code builds binary strings from status byte `0` and status byte `2`.

If:

```text
status0 bit at charAt(2) == '1'
and status2 bit at charAt(7) != '1'
```

then:

```text
673: setResult(EcrResponseEnum.GENERAL_ERROR)
680: setResponseBytes(null)
```

Bytecode evidence:

```text
511: getStatus().size()
520: bipush 6
522: if_icmpne done
525: status[0] -> Integer.toBinaryString -> Utils.formatText
553: status[2] -> Integer.toBinaryString -> Utils.formatText
647: status0.charAt(2)
653: '1'
658: status2.charAt(7)
665: '1'
670: mark done
673: setResult(EcrResponseEnum.GENERAL_ERROR)
680: setResponseBytes(null)
```

The code also sets `commandError` from `status0.charAt(7) == '1'` and logs `COMMAND ERROR!!!`, but it does not visibly change `EcrResponseEnum` for that condition.

## Utility Methods Used by Protocol Parsing

### Utils.getDataFromMessage(List)

Class/method: `ecr.utils.Utils.getDataFromMessage(List message)`

```text
if message.size() < 17:
    return null

dataLength = message.size() - 17
data = []
for i in 0..dataLength-1:
    data.add(message.get(i + 4))
return data
```

### Utils.getStatusFromMessage(List)

Class/method: `ecr.utils.Utils.getStatusFromMessage(List message)`

```text
if message.size() < 17:
    return null

dataLength = message.size() - 17
status = []
for i in 0..5:
    status.add(message.get(i + dataLength + 5))
return status
```

### Utils.getIntListFromString(String)

Class/method: `ecr.utils.Utils.getIntListFromString(String)`

Converts a string to `cp1251` bytes and returns each byte as unsigned integer using `byte & 0xFF`.

```text
9:  ldc "cp1251"
11: String.getBytes("cp1251")
37: list.add(byteValue & 255)
```

### Utils.getStringFromIntList(List)

Class/method: `ecr.utils.Utils.getStringFromIntList(List)`

Converts a list of integers to bytes, then constructs a string using `cp1251`.

```text
24: byteArray[i] = (byte) list.get(i).intValue()
47: new String(byteArray, "cp1251")
```

### Utils.toByteArrayString(List) and Utils.toByteArrayString(byte[])

Class/methods:

- `ecr.utils.Utils.toByteArrayString(List)`
- `ecr.utils.Utils.toByteArrayString(byte[])`

Both render bytes as uppercase two-character hex strings separated by spaces. These are logging helpers, not protocol validation helpers.

## AEcrCommand Protocol Surface

Class: `ecr.ecrcommunication.core.AEcrCommand`

Visible fields:

```text
commandEnum  : CommandsEnum
sequenceCode : int
```

Constructor and accessors:

```text
AEcrCommand.<init>(CommandsEnum)
  5: aload_1
  6: putfield commandEnum

getCommandEnum()
  1: getfield commandEnum

getSequenceCode()
  1: getfield sequenceCode

setSequenceCode(int)
  2: putfield sequenceCode
```

`toIntList()` is declared on `AEcrCommand`, but no bytecode body was visible in the base class output. `EcrSerialPort.packageCommand(...)` treats it as the payload provider.

## CommandsEnum Values

Class: `ecr.ecrcommunication.enums.CommandsEnum`

The table below was extracted from enum constructor calls in `CommandsEnum.<clinit>()`.

| enum name | integer value | hex value |
|---|---:|---:|
| UNKNOWN | -1 | 0xFF |
| WRITE_SETTINGS_TO_FLASH | 41 | 0x29 |
| SET_HEADER_FOOTER | 43 | 0x2B |
| SET_DATE_TIME | 61 | 0x3D |
| FISCALIZATION | 72 | 0x48 |
| SET_MULTIPLIER_DECIMALS_ETC | 83 | 0x53 |
| SET_SERIALNUMBER_FMNUMBER | 91 | 0x5B |
| SET_TAX_RATES | 96 | 0x60 |
| SET_TAX_REGISTRATION_NUMBER | 98 | 0x62 |
| SET_OPERATOR_PASSWORD | 101 | 0x65 |
| SET_OPERATOR_NAME | 102 | 0x66 |
| CLEAR_OPERATOR_DATA | 104 | 0x68 |
| SET_AND_READ_ITEMS | 107 | 0x6B |
| GET_FISCAL_ENTRY_PERIOD_INFO | 115 | 0x73 |
| OPEN_NONFISCAL_RECEIPT | 38 | 0x26 |
| CLOSE_NONFISCAL_RECEIPT | 39 | 0x27 |
| PRINT_NONFISCAL_FREE_TEXT | 42 | 0x2A |
| OPEN_FISCAL_RECEIPT | 48 | 0x30 |
| REGISTER_SALE | 49 | 0x31 |
| SUBTOTAL | 51 | 0x33 |
| REGISTER_SALE_AND_SHOW_ON_SCREEN | 52 | 0x34 |
| CALCULATE_TOTAL | 53 | 0x35 |
| PRINT_FREE_FISCAL_TEXT | 54 | 0x36 |
| CLOSE_FISCAL_RECEIPT | 56 | 0x38 |
| CANCEL_FISCAL_RECEIPT | 60 | 0x3C |
| REGISTER_ITEM_SALE | 58 | 0x3A |
| PRINT_DUPLICATE | 109 | 0x6D |
| DAILY_FINANCIAL_REPORT | 69 | 0x45 |
| REPORT_CHANGED_TAX_RATES | 50 | 0x32 |
| DETAILED_FM_REPORT_NUMBER | 73 | 0x49 |
| DETAILED_FM_REPORT_DATE | 94 | 0x5E |
| SHORT_FM_REPORT_NUMBER | 95 | 0x5F |
| SHORT_FM_REPORT_DATE | 79 | 0x4F |
| OPERATORS_REPORT | 105 | 0x69 |
| ITEMS_REPORT | 111 | 0x6F |
| GET_DATE_TIME | 62 | 0x3E |
| GET_LAST_FISCAL_ENTRY | 64 | 0x40 |
| GET_DAILY_TAX | 65 | 0x41 |
| GET_DAILY_SUMS | 67 | 0x43 |
| GET_NUMBER_OF_FREE_ENTRIES_IN_FM | 68 | 0x44 |
| GET_STATUS_BYTES | 74 | 0x4A |
| GET_FISCAL_TRANSACTION_STATUS | 76 | 0x4C |
| GET_DIAGNOSTIC_INFORMATION | 90 | 0x5A |
| GET_TAX_RATES | 97 | 0x61 |
| GET_TAX_REGISTRATION_NUMBER | 99 | 0x63 |
| GET_INFO_CURRENT_RECEIPT | 103 | 0x67 |
| GET_ADDITIONAL_DAILY_INFO | 110 | 0x6E |
| GET_OPERATOR_INFO | 112 | 0x70 |
| GET_LAST_PRINTED_DOCUMENT_INFO | 113 | 0x71 |
| GET_FISCAL_ENTRY_BLOCK_INFO | 114 | 0x72 |
| PAPER_FEED | 44 | 0x2C |
| CUT_PAPER | 45 | 0x2D |
| CLEAR_DISPLAY | 33 | 0x21 |
| SHOW_TEXT_LOWER_LINE | 35 | 0x23 |
| SHOW_TEXT_UPPER_LINE | 47 | 0x2F |
| DISPLAY_SHOW_DATE_TIME | 63 | 0x3F |
| DISPLAY_FULL_CONTROL | 100 | 0x64 |
| CASH_IN_OUT | 70 | 0x46 |
| PRINT_DIAGNOSTIC | 71 | 0x47 |
| PROGRAM_PRODUCTION_TEST_AREA | 89 | 0x59 |
| DRAWER_KICKOUT | 106 | 0x6A |
| OPEN_VOID_RECEIPT | 85 | 0x55 |
| CLOSE_VOID_RECEIPT | 86 | 0x56 |
| FORMAT | 134 | 0x86 |
| PROGRAMMING | 255 | 0xFF |
| SERVER_OPERATIONS | 144 | 0x90 |
| MANUAL_SERVER_CONNECTION_D35 | 145 | 0x91 |
| REGISTER_SERVICE_CONTRACT | 125 | 0x7D |
| REGISTER_PRINTER | 75 | 0x4B |
| MANUAL_SERVER_CONNECTION_PF550 | 34 | 0x22 |
| EJ_USE | 119 | 0x77 |
| RAM_RESET | 128 | 0x80 |
| READ_SETTINGS_PRINTER | 124 | 0x7C |
| READ_SETTINGS_CASH_REGISTER | 123 | 0x7B |
| TEST_MODEM_PRINTER | 126 | 0x7E |
| READ_CASH_REGISTER_EJ | 125 | 0x7D |

Notes:

- `UNKNOWN` and `PROGRAMMING` both render as `0xFF` when masked to one byte.
- `REGISTER_SERVICE_CONTRACT` and `READ_CASH_REGISTER_EJ` both have integer value `125` (`0x7D`).

## Unknowns / Not Visible

The following were not proven by inspected bytecode:

- Response checksum byte positions.
- Response checksum validation algorithm.
- Any use of response length byte to terminate reads.
- Exact semantic meaning of unclassified response bytes around status/checksum.
- Purpose of the `READ_SETTINGS_PRINTER` special case for byte `21`.

