# Accent Java SDK Project Analysis

This document describes the workspace structure and application shape observed from the opened `accent-fiscal-analysis` directory. It intentionally stops before protocol-level analysis.

## Physical Workspace

```text
D:\accent-fiscal-analysis
+-- Ecr-1.7.739
    +-- Ecr-1.7.739.jar
    +-- logs
        +-- application.log
        +-- communication.log
        +-- ecr.log
```

The workspace does not contain source files, Maven/Gradle project files, or loose configuration files outside the JAR. The main artifact is a runnable fat JAR plus runtime logs.

## JAR Structure

The JAR is a bundled Java 8 application. The manifest declares:

- `Main-Class: ecr.Main`
- `Implementation-Build: 739`
- Built with Maven and JDK 1.8

Important embedded areas:

- `ecr/`: application classes, UI classes, services, loggers, utilities, and fiscal-device communication.
- `ecr/ecrcommunication/`: command facade and serial communication implementation.
- `ecr/ecrcommunication/commands/`: command objects grouped by area, including articles, display, fiscal receipt, info, reports, server, special, and read EJ.
- `ecr/ecrcommunication/core/`: command interfaces/base classes.
- `ecr/ecrcommunication/enums/`: command, response, device, payment, VAT, status, and error enums.
- `ecr/ui/` and `ecr/ui/panels/`: Swing UI, including `Mainframe` and `ConnectionPanel`.
- `ecr/services/`: local and collab service classes.
- `ecr/ini/`: INI reader wrapper around `ini4j`.
- `ecr/loggers/`: custom logging facade and logger initialization.
- `resources/`: embedded resources, including `log4j.properties`, images, and WSDL/XML files.
- `jssc/` and `libs/`: bundled serial communication library and native binaries.
- `META-INF/maven/`: Maven metadata for embedded dependencies.
- Third-party packages under `org/`, `com/`, `net/`, `javax/`, `antlr/`, `javassist/`, and `webservices/`.

## Libraries

The JAR includes these notable libraries:

- `jSSC 2.8`: serial port API and native binaries for Windows, Linux, macOS, and Solaris.
- `log4j 1.2.17`: logging backend.
- `ini4j 0.5.2`: INI configuration parsing.
- Spring 3-era components: context/configuration support.
- Hibernate/JPA/Tomcat JDBC pool/MySQL JDBC: database access.
- JasperReports 6.1.0, JFreeChart, ZXing, Castor XML, Jackson 2.1.4, Apache HttpClient, Commons libraries, and Maven SCM/VFS utilities.

## Configuration Files

Embedded configuration:

- `META-INF/MANIFEST.MF`
  - Defines `ecr.Main` as the entry point.
  - Records Maven/JDK build metadata.

- `resources/log4j.properties`
  - Configures root log4j output to console and `${rootPath}/logs/ecr.log`.
  - Uses `RollingFileAppender`, 5 MB max file size, 2 backups.
  - Pattern: `dd.MM.yyyy HH:mm:ss,SSS LEVEL logger:line - message`.
  - Sets Hibernate SQL logging to `ERROR`.

- `application-context.xml`
  - Spring XML context with component scanning for Castor packages only.
  - The application also has annotation configuration through `ecr.ApplicationConfiguration`.

Runtime/configuration classes:

- `ecr.ini.IniFile`
  - Wraps `org.ini4j.Ini`.
  - Supports required and optional string/int/double/boolean reads.

- `ecr.ApplicationConfiguration`
  - Builds application and collab data sources.
  - Uses constants such as `DB_IP_ADDRESS`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, and corresponding collab DB values.

- `ecr.utils.Constants`
  - Holds global runtime settings, including DB settings, server addresses, timeouts, `PRINTER_COM`, `PRINTER_BAUD`, logger references, printer status flags, and serial retry timeout constants.
  - Default serial constant observed: `COM5`.

- `ecr.services.ecr.SettingService`
  - Reads/writes local settings from the `setting` table.

- `ecr.services.collab.EcrSettingService`
  - Reads collab settings such as upload timeout, registration/communication server address and port, and collab servlet settings.

No loose `.ini` file was present in the workspace at inspection time, although the bytecode references INI-reading startup helpers.

## Log Files

Physical log files:

- `logs/application.log`
  - Contains startup/open-port and exception logs.
  - Current entries show failed communication during `openPort()`.

- `logs/communication.log`
  - Contains communication-level `EcrSerialPort.sendReceiveCommand(...)` results.
  - Current entries show repeated `TIMEOUT_READING` responses.

- `logs/ecr.log`
  - Present but empty during inspection.

Additional log files are initialized by `EcrLoggerUtils`:

- `application.log`
- `communication.log`
- `fiscalization.log`
- `change.log`
- `deregistration.log`
- `synchronization.log`
- `updater.log`
- `socket.log`

## Logging Strategy

Logging is split between embedded log4j configuration and a custom application logger layer:

- `resources/log4j.properties` configures the generic root logger to `${rootPath}/logs/ecr.log`.
- `ecr.loggers.EcrLoggerUtils.initializeLoggers()` resets/configures log4j and creates named application loggers.
- `ecr.loggers.EcrLoggerFactory.getLogger(String, boolean)` constructs `EcrLoggerImpl` instances.
- `ecr.loggers.EcrLoggerImpl` supports `info`, `warning`, `error(String)`, `error(Throwable)`, and `error(String, Exception)`.
- `EcrLoggerImpl` writes under `logs/` and can also push messages to the UI log dialog.
- `Constants` stores logger references such as `APPLICATION_LOGGER`, `COMMUNICATION_LOGGER`, `FISCALIZATION_LOGGER`, `CHANGE_LOGGER`, `DEREGISTRATION_LOGGER`, `SYNCHRONIZATION_LOGGER`, `SOCKET_LOGGER`, and `UPDATER_LOGGER`.

Observed logging behavior:

- `ConnectionPanel.openPort()` logs to `APPLICATION_LOGGER`.
- `EcrSerialPort.sendReceive()` logs command names.
- `EcrSerialPort.sendReceiveCommand()` logs `EcrResponse.toString()` results to the communication logger.
- Exceptions include expanded stack traces via the custom logger utility.

## Important Classes

### Startup/UI

- `ecr.Main`
  - Main entry point.
  - Methods include `main`, `startSomeOfTheNonFiscalizationModes`, `checkAndStartFiscalizationMode`, and `checkVersion`.
  - Initializes loggers, reads configuration, creates Spring annotation context, checks version/connectivity, and starts application modes.

- `ecr.StartApp`
  - Application startup component.
  - Methods include `start`, `init`, `initEcrSettings`, `initOperators`, `initCollabSimServlet`, `startCollabSynchronizationThread`, and `startUpdater`.

- `ecr.ApplicationConfiguration`
  - Spring Java configuration.
  - Provides data sources, Hibernate properties, session factories, transaction managers, and the `StartApp` bean.

- `ecr.ui.Mainframe`
  - Main Swing frame.
  - Hosts the connection panel, settings panels, server panels, report/status panels, and log dialog access.

- `ecr.ui.panels.ConnectionPanel`
  - Serial connection UI.
  - Important methods: `openPort`, `closePort`, `readSettingsFromDB`, `writeSettingsToDB`, `disableComponents`, and `enableComponents`.
  - Uses `jssc.SerialPortList` to populate serial ports.

### Communication Facade

- `ecr.ecrcommunication.Ecr`
  - High-level device facade.
  - Owns an `EcrSerialPort`.
  - Exposes operations such as status reads, date/time reads and writes, reports, fiscalization, articles, server parameters, EJ reads, settings, and direct `sendReceive(AEcrCommand)`.
  - Provides `isPortOpened()` and `closePort()`.

- `ecr.ecrcommunication.core.IEcrCommand`
  - Marker/interface layer for ECR command objects.

- `ecr.ecrcommunication.core.AEcrCommand`
  - Base command class.
  - Contains a `CommandsEnum commandEnum`.
  - Provides `getCommandEnum()` and `setCommandEnum()`.

- `ecr.ecrcommunication.commands.*`
  - Concrete command classes grouped by functional area.
  - Examples: `GetStatus`, `GetDiagnosticInformationPrinter`, `GetDiagnosticInformationCashRegister`, `OpenFiscalReceipt`, `CloseFiscalReceipt`, `ProgramArticle`, `DailyClosureReport`, `ManualServerConnectionPrinter`, and `CustomCommand`.

### Serial Communication

- `ecr.ecrcommunication.EcrSerialPort`
  - Low-level serial transport wrapper around `jssc.SerialPort`.
  - Fields observed:
    - `commPort`
    - `bps`
    - `serialPort`
    - `NAK`
    - `SYN`
    - `isFirstCommandExecuted`
    - `readByteTimeout`
    - `waitSynTimeout`
    - `waitBeforeRetryReadByteTimeout`
  - Methods observed:
    - constructor `(String commPortNumber, int bps)`
    - `openSerialPort()`
    - `closePort()`
    - `isPortOpened()`
    - `readByte()`
    - `readBytes()`
    - `clearSerialPortBuffer()`
    - `packageCommand(AEcrCommand, boolean)`
    - `writeAndRead(AEcrCommand, boolean)`
    - `readFromSerialPort(AEcrCommand)`
    - `sendReceive(AEcrCommand)`
    - `sendReceiveCommand(AEcrCommand)`

- `ecr.ecrcommunication.EcrResponse`
  - Transport/result object returned by serial calls.
  - Fields:
    - `responseBytes`
    - `response`
    - `data`
    - `status`
    - `commandError`
  - Provides getters/setters, `getResult()`, `getResponse()`, `isCommandError()`, and `toString()`.

- `ecr.ecrcommunication.enums.EcrResponseEnum`
  - Observed response states:
    - `UNKNOWN`
    - `OK`
    - `NAK_RECEIVED`
    - `SYN_TIMEOUT`
    - `TIMEOUT_READING`
    - `WRONG_COMMAND_RESPONSE`
    - `GENERAL_ERROR`
    - `SYNTAX_ERROR`
    - `INVALID_RESPONSE`

- `ecr.ecrcommunication.enums.EcrErrorEnum`
  - Observed error states:
    - `NO_ERROR`
    - `NO_PAPER`
    - `PRINTER_OFFLINE`

### Supporting Runtime Classes

- `ecr.utils.DBChecker`
  - Creates/checks local database and tables, including `fiscalization` and `setting`.

- `ecr.httpclient.EcrHttpClient`
  - HTTP/collab communication support.

- `ecr.threads.*`
  - Background threads for socket printing, updates, collab synchronization, device testing, and fiscal receipt printing.

## Startup Flow

Observed startup path from manifest/class metadata:

1. JVM starts `ecr.Main`.
2. `Main.main(String[] args)` establishes the application root path and initializes logging through `EcrLoggerUtils.initializeLoggers()`.
3. Startup reads configuration through INI-related helpers and runtime constants.
4. `Main` creates an annotation-based Spring context using `ecr.ApplicationConfiguration`.
5. `ApplicationConfiguration` initializes DB/collab data sources and Spring-managed services.
6. `StartApp.start()` runs application initialization:
   - `init()`
   - `initEcrSettings()`
   - `initOperators()`
   - `initCollabSimServlet()`
   - synchronization/updater startup where relevant
7. UI startup creates `Mainframe`, including `ConnectionPanel`.
8. `ConnectionPanel` loads persisted COM port and baud settings when available.

## Serial Communication Flow

This is the application-level call flow only, not a protocol analysis.

1. User opens the port from `ConnectionPanel`.
2. `ConnectionPanel.openPort()` logs entry and creates/uses an `Ecr` instance.
3. `Ecr` owns `EcrSerialPort`, initialized with COM port and baud rate.
4. Connection validation calls `Ecr.getDevice()`.
5. `Ecr.getDevice()` sends a diagnostic information command through `Ecr.sendReceive(AEcrCommand)`.
6. `Ecr.sendReceive()` delegates to `EcrSerialPort.sendReceive(AEcrCommand)`.
7. `EcrSerialPort.sendReceive()` logs the command name and delegates into `sendReceiveCommand(AEcrCommand)`.
8. `sendReceiveCommand()` performs the write/read command lifecycle and returns `EcrResponse`.
9. `readFromSerialPort(AEcrCommand)` reads bytes and populates `EcrResponse` with result, data, status, and command error state.
10. On timeout or failed response, `sendReceiveCommand()` logs `EcrResponse.toString()` and may throw `EcrOfflineException`.
11. `ConnectionPanel.openPort()` handles the returned execution status or exception and updates UI state.

Observed log call path during failed startup communication:

```text
ConnectionPanel.openPort()
Ecr.getDevice()
EcrSerialPort.sendReceive()
EcrSerialPort.sendReceiveCommand()
EcrSerialPort.readFromSerialPort()
```

The current logs show `GET_DIAGNOSTIC_INFORMATION` followed by repeated `TIMEOUT_READING` results and an `EcrOfflineException`.

## Current Runtime Observation

The logs contain two failed open-port attempts on `07.07.2026`:

- `ConnectionPanel.openPort()` was entered.
- `EcrSerialPort.sendReceive()` attempted `GET_DIAGNOSTIC_INFORMATION`.
- `EcrSerialPort.readFromSerialPort()` repeatedly timed out.
- `sendReceiveCommand()` logged:

```text
EcrResponse [responseBytes=null, response=TIMEOUT_READING, data=null, status=null, commandError=false]
```

This confirms that the serial stack was reached, but no successful device response was captured in the available logs.

## Explicitly Not Covered

Per instruction, this document does not analyze:

- byte-level protocol framing
- command payload formats
- checksum/LRC rules
- device response byte meanings
- fiscal command semantics
