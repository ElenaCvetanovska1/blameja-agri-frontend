namespace Blameja.FiscalBridge.Protocol;

public enum AccentResponseStatus
{
    OK,
    NAK_RECEIVED,
    TIMEOUT_READING,
    WRONG_COMMAND_RESPONSE,
    INVALID_RESPONSE,
    GENERAL_ERROR,
    SERIAL_ERROR
}
