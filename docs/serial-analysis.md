# Serial Communication Analysis

Scope: this document analyzes low-level serial communication in `Ecr-1.7.739.jar` only. It does not analyze fiscal business command semantics or protocol meaning beyond what is necessary to explain read/write control flow.

Inspected classes:

- `ecr.ecrcommunication.EcrSerialPort`
- `ecr.ecrcommunication.Ecr`
- `ecr.ecrcommunication.EcrResponse`
- `ecr.ecrcommunication.enums.EcrResponseEnum`
- `ecr.ecrcommunication.core.AEcrCommand`
- `ecr.utils.Constants`
- `ecr.ui.panels.ConnectionPanel`

## Summary

The low-level serial implementation is centered on `ecr.ecrcommunication.EcrSerialPort`. `ConnectionPanel.openPort()` reads the selected COM port and baud rate from the UI, constructs `new Ecr(comPort, baud)`, and `Ecr` constructs `new EcrSerialPort(comPort, baud)`. The `EcrSerialPort` constructor immediately opens the port.

Serial settings visible in bytecode:

```text
baud:      dynamic, stored in EcrSerialPort.bps
data bits: 8
stop bits: 1
parity:    0
flow control / handshake: UNKNOWN; no explicit setFlowControlMode/setRTS/setDTR call was found
```

## 1. Constructor Behavior of EcrSerialPort

Class/method: `ecr.ecrcommunication.EcrSerialPort.<init>(String commPortNumber, int bps)`

Observed behavior:

1. Calls `Object.<init>()`.
2. Initializes defaults:
   - `commPort = "COM1"`
   - `bps = 9600`
   - `serialPort = null`
   - `NAK = 21`
   - `SYN = 22`
   - `isFirstCommandExecuted = false`
   - `readByteTimeout = 50`
   - `waitSynTimeout = 10`
   - `waitBeforeRetryReadByteTimeout = 10`
3. Overwrites `commPort` with constructor argument `commPortNumber`.
4. Overwrites `bps` with constructor argument `bps`.
5. Calls `openSerialPort()` immediately.
6. Stores the returned `jssc.SerialPort` into `serialPort`.

Bytecode evidence:

```text
EcrSerialPort.<init>(String,int)
  5: ldc "COM1"
  7: putfield EcrSerialPort.commPort
 11: sipush 9600
 14: putfield EcrSerialPort.bps
 23: bipush 21
 25: putfield EcrSerialPort.NAK
 29: bipush 22
 31: putfield EcrSerialPort.SYN
 40: bipush 50
 42: putfield EcrSerialPort.readByteTimeout
 46: bipush 10
 48: putfield EcrSerialPort.waitSynTimeout
 52: bipush 10
 54: putfield EcrSerialPort.waitBeforeRetryReadByteTimeout
 58: aload_1
 59: putfield EcrSerialPort.commPort
 63: iload_2
 64: putfield EcrSerialPort.bps
 69: invokevirtual EcrSerialPort.openSerialPort()
 72: putfield EcrSerialPort.serialPort
```

## 2. Where the COM Port Name Is Stored

Class/method: `ecr.ecrcommunication.EcrSerialPort.<init>(String,int)`

- Stored in instance field `EcrSerialPort.commPort`.
- The constructor first sets `"COM1"`, then overwrites it with the constructor argument.

Class/method: `ecr.ecrcommunication.EcrSerialPort.openSerialPort()`

- `commPort` is read and passed into `new jssc.SerialPort(commPort)`.

Bytecode evidence:

```text
EcrSerialPort.openSerialPort()
  1: new jssc/SerialPort
  5: aload_0
  6: getfield EcrSerialPort.commPort
  9: invokespecial jssc/SerialPort.<init>(String)
 12: putfield EcrSerialPort.serialPort
```

Class/method: `ecr.ui.panels.ConnectionPanel.openPort()`

- The selected UI COM port is passed into `new Ecr(...)`.
- The selected UI COM port is also stored globally in `Constants.PRINTER_COM`.

Bytecode evidence:

```text
ConnectionPanel.openPort()
 32: new ecr/ecrcommunication/Ecr
 37: getfield ConnectionPanel.comPortListComboBox
 40: invokevirtual JComboBox.getSelectedItem()
 43: checkcast java/lang/String
 46: getstatic Constants.PRINTER_BAUD
 49: invokespecial Ecr.<init>(String,int)

 86: getfield ConnectionPanel.comPortListComboBox
 90: invokevirtual JComboBox.getSelectedItem()
 93: checkcast java/lang/String
 96: putstatic Constants.PRINTER_COM
```

## 3. Where Baud Rate Is Stored

Class/method: `ecr.ecrcommunication.EcrSerialPort.<init>(String,int)`

- Stored in instance field `EcrSerialPort.bps`.
- Default is `9600`, then overwritten with the constructor argument.

Class/method: `ecr.ui.panels.ConnectionPanel.openPort()`

- Reads selected baud from `cmbBaudRate`.
- Converts it with `Integer.parseInt(...)`.
- Stores it in `Constants.PRINTER_BAUD`.
- Passes `Constants.PRINTER_BAUD` into `new Ecr(...)`.

Bytecode evidence:

```text
ConnectionPanel.openPort()
 17: getfield ConnectionPanel.cmbBaudRate
 20: invokevirtual JComboBox.getSelectedItem()
 23: invokevirtual Object.toString()
 26: invokestatic Integer.parseInt(String)
 29: putstatic Constants.PRINTER_BAUD
```

Class/method: `ecr.utils.Constants.<clinit>()`

- Default values:

```text
206: ldc "COM5"
208: putstatic Constants.PRINTER_COM
211: sipush 9600
214: putstatic Constants.PRINTER_BAUD
```

## 4. Exact Serial Settings Used When Opening the Port

Class/method: `ecr.ecrcommunication.EcrSerialPort.openSerialPort()`

The port is opened with `jssc.SerialPort.openPort()`, then configured with:

```text
serialPort.setParams(bps, 8, 1, 0)
```

Bytecode evidence:

```text
EcrSerialPort.openSerialPort()
 15: getfield EcrSerialPort.serialPort
 19: invokevirtual jssc/SerialPort.openPort()
 23: getfield EcrSerialPort.serialPort
 28: getfield EcrSerialPort.bps
 31: bipush 8
 33: iconst_1
 34: iconst_0
 35: invokevirtual jssc/SerialPort.setParams(IIII)
```

Interpretable from the call shape:

- baud rate: `EcrSerialPort.bps`
- data bits: `8`
- stop bits: `1`
- parity: `0`

Flow control / handshake:

- Class/method searched: `EcrSerialPort`, `Ecr`, `ConnectionPanel`
- No `setFlowControlMode`, `getFlowControlMode`, `setRTS`, `setDTR`, or `purgePort` reference was visible.
- Conclusion: `UNKNOWN`; no explicit flow-control/handshake configuration is visible in inspected bytecode.

## 5. Exact Method Where jssc.SerialPort Is Opened

Class/method: `ecr.ecrcommunication.EcrSerialPort.openSerialPort()`

Bytecode evidence:

```text
15: getfield EcrSerialPort.serialPort
19: invokevirtual jssc/SerialPort.openPort()
```

## 6. Exact Method Where serialPort.setParams(...) Is Called

Class/method: `ecr.ecrcommunication.EcrSerialPort.openSerialPort()`

Bytecode evidence:

```text
23: getfield EcrSerialPort.serialPort
28: getfield EcrSerialPort.bps
31: bipush 8
33: iconst_1
34: iconst_0
35: invokevirtual jssc/SerialPort.setParams(IIII)
```

## 7. Exact Method Where Bytes Are Written

Class/method: `ecr.ecrcommunication.EcrSerialPort.writeAndRead(AEcrCommand command, boolean repeatCommand)`

The method calls `packageCommand(...)`, logs the request, iterates through the resulting `List<Integer>`, masks each value with `255`, and writes it with `jssc.SerialPort.writeInt(int)`.

Bytecode evidence:

```text
EcrSerialPort.writeAndRead(AEcrCommand,boolean)
 15: invokespecial EcrSerialPort.packageCommand(AEcrCommand,boolean)
 86: getfield EcrSerialPort.serialPort
 90: aload packagedCommandList
 94: invokeinterface List.get(int)
102: invokevirtual Integer.intValue()
105: sipush 255
108: iand
109: invokevirtual jssc/SerialPort.writeInt(int)
113: iinc loopIndex by 1
119: ldc2_w 10
122: invokestatic Thread.sleep(long)
130: invokespecial EcrSerialPort.readFromSerialPort(AEcrCommand)
```

## 8. Exact Method Where Bytes Are Read

There are three read-related methods.

Class/method: `ecr.ecrcommunication.EcrSerialPort.readByte()`

- Calls `serialPort.readIntArray(1, 50)`.
- Catches `SerialPortException` and `SerialPortTimeoutException`.
- Returns `null` on exception.

Bytecode evidence:

```text
EcrSerialPort.readByte()
  3: getfield EcrSerialPort.serialPort
  6: iconst_1
  7: bipush 50
  9: invokevirtual jssc/SerialPort.readIntArray(II)
```

Class/method: `ecr.ecrcommunication.EcrSerialPort.readBytes()`

- Calls `serialPort.readIntArray()` with no explicit timeout argument.
- Catches `SerialPortException`.
- Returns `null` on exception.

Bytecode evidence:

```text
EcrSerialPort.readBytes()
 2: getfield EcrSerialPort.serialPort
 6: invokevirtual jssc/SerialPort.readIntArray()
```

Class/method: `ecr.ecrcommunication.EcrSerialPort.readFromSerialPort(AEcrCommand)`

- This is the main receive loop used by `writeAndRead(...)`.
- It repeatedly calls private `readBytes()`.

Bytecode evidence:

```text
EcrSerialPort.readFromSerialPort(AEcrCommand)
 36: invokespecial EcrSerialPort.readBytes()
 40: astore readBytesResult
```

## 9. Read Timeout Values

Class/method: `ecr.ecrcommunication.EcrSerialPort.<init>(String,int)`

Fields initialized:

```text
readByteTimeout = 50
waitSynTimeout = 10
waitBeforeRetryReadByteTimeout = 10
```

Class/method: `ecr.ecrcommunication.EcrSerialPort.readByte()`

- Uses literal timeout `50` in `serialPort.readIntArray(1, 50)`.

Class/method: `ecr.ecrcommunication.EcrSerialPort.readFromSerialPort(AEcrCommand)`

- Uses `Thread.sleep(10)` when a SYN byte is received.
- Uses `Thread.sleep(10)` when no bytes are available.
- The constant pool confirms the sleep constant is `10L`.

Class/method: `ecr.utils.Constants.<clinit>()`

Retry constants:

```text
443: bipush 10
445: putstatic Constants.PRINTER_TIMEOUT_RETRIES_COUNT
448: iconst_2
449: putstatic Constants.PRINTER_RETRIES_COUNT
```

Interpretation tied to bytecode:

- Empty-read retry limit uses `Constants.PRINTER_TIMEOUT_RETRIES_COUNT = 10`.
- Command retry limit uses `Constants.PRINTER_RETRIES_COUNT = 2`.

## 10. Retry Logic

Class/method: `ecr.ecrcommunication.EcrSerialPort.sendReceiveCommand(AEcrCommand)`

Before sending:

```text
 8: invokespecial EcrSerialPort.clearSerialPortBuffer()
```

The method calls `writeAndRead(...)` in a retry loop.

Retryable results are checked explicitly:

```text
45: getResult()
49: EcrResponseEnum.NAK_RECEIVED
56: getResult()
59: EcrResponseEnum.TIMEOUT_READING
66: getResult()
69: EcrResponseEnum.WRONG_COMMAND_RESPONSE
76: getResult()
79: EcrResponseEnum.SYN_TIMEOUT
86: getResult()
89: EcrResponseEnum.INVALID_RESPONSE
```

Retry counter logic:

```text
140: iconst_0
141: istore repeatCommandFlag
143: iinc retryCounter by 1
146: iload retryCounter
148: getstatic Constants.PRINTER_RETRIES_COUNT
151: if_icmple retryAgain
154: markDone
```

With `Constants.PRINTER_RETRIES_COUNT = 2`, the bytecode permits the first attempt plus retry attempts while the retry counter is `<= 2`.

Class/method: `ecr.ecrcommunication.EcrSerialPort.readFromSerialPort(AEcrCommand)`

Empty-read retry logic:

```text
770: Thread.sleep(10)
781: iinc timeoutRetryCounter by 1
784: iload timeoutRetryCounter
786: getstatic Constants.PRINTER_TIMEOUT_RETRIES_COUNT
789: if_icmple readAgain
820: setResult(EcrResponseEnum.TIMEOUT_READING)
827: setResponseBytes(null)
```

With `Constants.PRINTER_TIMEOUT_RETRIES_COUNT = 10`, the timeout log is reached after the counter exceeds 10. Existing logs show this as `retriesCount=11`, matching the bytecode structure.

## 11. Buffer Clearing Logic

Class/method: `ecr.ecrcommunication.EcrSerialPort.sendReceiveCommand(AEcrCommand)`

- Calls `clearSerialPortBuffer()` once before entering the command send/retry loop.

Class/method: `ecr.ecrcommunication.EcrSerialPort.clearSerialPortBuffer()`

- Calls `serialPort.readBytes()`.
- If returned bytes are non-null, logs them as forgotten bytes.
- Catches an exception and ignores it.
- No `jssc.SerialPort.purgePort(...)` call was visible.

Bytecode evidence:

```text
EcrSerialPort.clearSerialPortBuffer()
 0: getfield EcrSerialPort.serialPort
 4: invokevirtual jssc/SerialPort.readBytes()
 8: ifnull return
12: getstatic Constants.COMMUNICATION_LOGGER
22: ldc "forgotten bytes: "
38: invokestatic Utils.toByteArrayString(byte[])
52: invokeinterface EcrLogger.error(String)
```

## 12. What Happens When Timeout Occurs

Class/method: `ecr.ecrcommunication.EcrSerialPort.readFromSerialPort(AEcrCommand)`

If no bytes are available:

1. Sleeps for `10 ms`.
2. Increments timeout retry counter.
3. Repeats while counter is `<= Constants.PRINTER_TIMEOUT_RETRIES_COUNT`.
4. Logs timeout through `Constants.APPLICATION_LOGGER`.
5. Sets result to `EcrResponseEnum.TIMEOUT_READING`.
6. Sets response bytes to `null`.

Bytecode evidence:

```text
792: getstatic Constants.APPLICATION_LOGGER
802: ldc "EcrSerialPort.readFromSerialPort()  T I M E O U T _ R E A D I N G..."
820: setResult(EcrResponseEnum.TIMEOUT_READING)
827: setResponseBytes(null)
```

Class/method: `ecr.ecrcommunication.EcrSerialPort.sendReceiveCommand(AEcrCommand)`

If the final result is `TIMEOUT_READING` after retries:

1. Sets `Constants.PRINTER_OFFLINE = true`.
2. Throws `ecr.ecrcommunication.exceptions.EcrOfflineException`.

Bytecode evidence:

```text
172: getResult()
176: EcrResponseEnum.TIMEOUT_READING
182: iconst_1
183: putstatic Constants.PRINTER_OFFLINE
186: new EcrOfflineException
193: athrow
```

## 13. What Happens When NAK Is Received

Class/method: `ecr.ecrcommunication.EcrSerialPort.readFromSerialPort(AEcrCommand)`

Incoming byte dispatch has a `lookupswitch`:

```text
83: lookupswitch default->249 1->207 21->116 22->172
```

For byte `21`, the code treats it as NAK:

```text
116: getstatic Constants.COMMUNICATION_LOGGER
119: ldc "NAK received!!!"
121: EcrLogger.error(String)
159: mark read loop done
162: setResult(EcrResponseEnum.NAK_RECEIVED)
169: return path
```

Special visible case:

- If the parser is already inside a message and the command is `CommandsEnum.READ_SETTINGS_PRINTER`, the byte is added to the current response list and control continues through the SYN-handling path.
- Purpose: `UNKNOWN`.

Bytecode evidence:

```text
126: if not insideMessage -> set NAK_RECEIVED
132: getCommandEnum()
135: CommandsEnum.READ_SETTINGS_PRINTER
141: responseList.add(currentByte)
156: goto 172
```

## 14. What Happens When SYN Is Expected or Received

Class/method: `ecr.ecrcommunication.EcrSerialPort.readFromSerialPort(AEcrCommand)`

The class defines `SYN = 22`. Incoming byte `22` routes to the SYN branch:

```text
83: lookupswitch default->249 1->207 21->116 22->172
```

Observed SYN branch behavior:

1. Increments a SYN counter.
2. If the counter exceeds `19`, resets it to `0` and prints `20 x syn` to `System.out`.
3. Sleeps for `10 ms`.
4. Continues scanning/reading.

Bytecode evidence:

```text
172: iinc synCounter by 1
175: iload synCounter
177: bipush 19
179: if_icmple continue
182: iconst_0
183: istore synCounter
185: getstatic System.out
188: ldc "20 x syn"
190: PrintStream.println(String)
193: ldc2_w 10
196: Thread.sleep(long)
199: continue
```

`EcrResponseEnum.SYN_TIMEOUT` is checked as retryable in `sendReceiveCommand(...)`, but no assignment to `SYN_TIMEOUT` was visible in the inspected `EcrSerialPort` bytecode. Therefore the exact producer of `SYN_TIMEOUT` is `UNKNOWN` from the inspected methods.

## 15. Whether the First Command Is Handled Differently

Class/method: `ecr.ecrcommunication.EcrSerialPort.sendReceive(AEcrCommand)`

Yes. The first command after opening the port is handled differently.

Behavior:

1. Logs requested command.
2. Checks `isFirstCommandExecuted`.
3. If false:
   - Sets `isFirstCommandExecuted = true`.
   - Sends a new `GetStatus` command through `sendReceiveCommand(...)`.
   - Discards that response.
4. Sends the originally requested command through `sendReceiveCommand(...)`.

Bytecode evidence:

```text
EcrSerialPort.sendReceive(AEcrCommand)
30: getfield EcrSerialPort.isFirstCommandExecuted
34: ifne sendRequestedCommand
37: iconst_1
39: putfield EcrSerialPort.isFirstCommandExecuted
43: new ecr/ecrcommunication/commands/info/GetStatus
50: invokespecial EcrSerialPort.sendReceiveCommand(AEcrCommand)
53: pop
54: aload_0
55: aload_1
56: invokespecial EcrSerialPort.sendReceiveCommand(AEcrCommand)
59: areturn
```

Class/method: `ecr.ecrcommunication.EcrSerialPort.closePort()`

- Resets first-command state:

```text
0: aload_0
1: iconst_0
2: putfield EcrSerialPort.isFirstCommandExecuted
5: getfield EcrSerialPort.serialPort
9: invokevirtual jssc/SerialPort.closePort()
```

## Supporting Class Notes

### ecr.ecrcommunication.Ecr

Class/method: `Ecr.<init>(String,int)`

- Stores a new `EcrSerialPort` in field `ecrSerialPort`.

```text
14: aload_0
15: new EcrSerialPort
19: aload_1
20: iload_2
21: invokespecial EcrSerialPort.<init>(String,int)
24: putfield Ecr.ecrSerialPort
```

Class/method: `Ecr.sendReceive(AEcrCommand)`

- Direct delegation:

```text
0: aload_0
1: getfield Ecr.ecrSerialPort
4: aload_1
5: invokevirtual EcrSerialPort.sendReceive(AEcrCommand)
8: areturn
```

Class/method: `Ecr.closePort()`

- Direct delegation:

```text
0: aload_0
1: getfield Ecr.ecrSerialPort
4: invokevirtual EcrSerialPort.closePort()
```

Class/method: `Ecr.isPortOpened()`

- Direct delegation:

```text
0: aload_0
1: getfield Ecr.ecrSerialPort
4: invokevirtual EcrSerialPort.isPortOpened()
7: ireturn
```

Class/method: `Ecr.getDevice()`

- Starts device detection by sending `GetDiagnosticInformationPrinter` through `EcrSerialPort.sendReceive(...)`.

```text
11: getfield Ecr.ecrSerialPort
15: new GetDiagnosticInformationPrinter
22: invokevirtual EcrSerialPort.sendReceive(AEcrCommand)
```

### ecr.ecrcommunication.EcrResponse

Visible fields:

```text
responseBytes : List
response      : EcrResponseEnum
data          : List
status        : List
commandError  : boolean
```

Visible methods:

```text
getResponseBytes / setResponseBytes
getResult / setResult
getData / setData
getStatus / setStatus
isCommandError / setCommandError
getResponse / setResponse
toString
```

The `toString()` template visible in constants is:

```text
EcrResponse [responseBytes=..., response=..., data=..., status=..., commandError=...]
```

Default constructor field values beyond visible field initialization: `UNKNOWN`.

### ecr.ecrcommunication.enums.EcrResponseEnum

Visible enum values:

```text
UNKNOWN
OK
NAK_RECEIVED
SYN_TIMEOUT
TIMEOUT_READING
WRONG_COMMAND_RESPONSE
GENERAL_ERROR
SYNTAX_ERROR
INVALID_RESPONSE
```

Low-level use in `EcrSerialPort`:

- `OK`: set when a complete response is read.
- `NAK_RECEIVED`: set when byte `21` is received outside the visible special case.
- `TIMEOUT_READING`: set when empty-read retries exceed the configured limit.
- `WRONG_COMMAND_RESPONSE`: set when the response command byte does not match the requested command.
- `INVALID_RESPONSE`: set after excessive garbage bytes before message start.
- `GENERAL_ERROR`: set from status-byte checks after an otherwise complete response.
- `SYN_TIMEOUT`: checked as retryable in `sendReceiveCommand(...)`; assignment source is `UNKNOWN`.
- `SYNTAX_ERROR`: no low-level assignment observed in inspected `EcrSerialPort` methods.
- `UNKNOWN`: enum value exists; whether `EcrResponse` assigns it by default is `UNKNOWN` from the inspected evidence.

### ecr.ecrcommunication.core.AEcrCommand

Visible fields:

```text
commandEnum  : CommandsEnum
sequenceCode : int
```

Visible methods:

```text
AEcrCommand(CommandsEnum)
toIntList()
getCommandEnum()
setCommandEnum(CommandsEnum)
getSequenceCode()
setSequenceCode(int)
```

Low-level use:

- `EcrSerialPort.packageCommand(AEcrCommand, boolean)` reads `command.getCommandEnum().getValue()`.
- `packageCommand(...)` reads and writes `command.sequenceCode`.
- `packageCommand(...)` calls `command.toIntList()` to append command data bytes, but command data content is not analyzed here.

### ecr.ui.panels.ConnectionPanel

Class/method: `ConnectionPanel.openPort()`

Low-level serial entry point from UI:

```text
16: getfield ConnectionPanel.cmbBaudRate
20: JComboBox.getSelectedItem()
23: Object.toString()
26: Integer.parseInt(String)
29: putstatic Constants.PRINTER_BAUD

32: new Ecr
37: getfield ConnectionPanel.comPortListComboBox
40: JComboBox.getSelectedItem()
43: checkcast String
46: getstatic Constants.PRINTER_BAUD
49: invokespecial Ecr.<init>(String,int)

86: getfield ConnectionPanel.comPortListComboBox
90: JComboBox.getSelectedItem()
93: checkcast String
96: putstatic Constants.PRINTER_COM

135: getstatic Constants.ECR
138: invokevirtual Ecr.getDevice()
```

Class/method: `ConnectionPanel.readSettingsFromDB()`

- Reads selected COM-port index from DB setting key `com_port_index`.
- Reads selected baud-rate index from DB setting key `com_port_baud_index`.
- Applies those indices to UI combo boxes.

Class/method: `ConnectionPanel.writeSettingsToDB()`

- Stores current COM-port combo index into `com_port_index`.
- Stores current baud combo index into `com_port_baud_index`.

This means persisted settings store combo-box indices, not direct COM-port or baud strings.
