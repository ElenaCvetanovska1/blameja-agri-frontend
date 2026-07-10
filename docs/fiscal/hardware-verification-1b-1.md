# Hardware Verification 1B-1

Date/time of verification: TODO - fill manually

## Serial settings

- COM port: COM4
- Baud: 9600

## Commands tested

### GET_STATUS_BYTES

Request hex:

```text
01 24 21 4A 05 30 30 39 34 03
```

Response hex:

```text
01 34 21 4A 50 09 80 80 80 80 86 9A 09 04 80 80 80 80 86 9A 05 30 37 34 3A 03
```

### GET_DIAGNOSTIC_INFORMATION

Request hex:

```text
01 25 22 5A 31 05 30 30 3D 37 03
```

Response hex:

```text
01 5D 22 5A 53 59 35 35 2C 33 35 34 36 32 38 20 30 36 4E 6F 76 31 35 20 31 38 30 30 2C 35 33 33 39 2C 30 30 30 30 30 30 30 30 2C 41 43 32 31 35 31 30 31 32 37 38 04 80 80 80 80 86 9A 05 30 3E 3A 3F 03
```

Decoded diagnostic data text:

```text
SY55,354628 06Nov15 1800,5339,00000000,AC215101278
```

## Conclusion

RS232 communication layer is confirmed for read-only status/diagnostic commands.

Receipt printing workflow is not yet confirmed.
