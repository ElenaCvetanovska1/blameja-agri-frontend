using Blameja.FiscalBridge.Serial;

namespace Blameja.FiscalBridge.Protocol;

public sealed class AccentResponseParser
{
    public AccentResponse Parse(byte expectedCommandId, SerialCommandResult serialResult)
    {
        if (serialResult.ResponseStatus is not AccentResponseStatus.OK)
        {
            return new AccentResponse(
                serialResult.ResponseStatus,
                serialResult.ResponseBytes,
                [],
                [],
                serialResult.Error);
        }

        var response = serialResult.ResponseBytes;
        if (response.Length < 4)
        {
            return new AccentResponse(
                AccentResponseStatus.INVALID_RESPONSE,
                response,
                [],
                [],
                "Response frame is shorter than the minimum command header.");
        }

        if (response[3] != expectedCommandId)
        {
            return new AccentResponse(
                AccentResponseStatus.WRONG_COMMAND_RESPONSE,
                response,
                [],
                [],
                $"Expected command id 0x{expectedCommandId:X2}, received 0x{response[3]:X2}.");
        }

        var dataBytes = Array.Empty<byte>();
        var statusBytes = Array.Empty<byte>();
        var responseStatus = AccentResponseStatus.OK;
        string? error = null;

        if (response.Length >= 17)
        {
            var dataLength = response.Length - 17;
            dataBytes = response.Skip(4).Take(dataLength).ToArray();
            statusBytes = response.Skip(dataLength + 5).Take(6).ToArray();

            if (IsGeneralError(statusBytes))
            {
                responseStatus = AccentResponseStatus.GENERAL_ERROR;
                error = "Fiscal device status bytes indicate a general error.";
            }
        }

        return new AccentResponse(responseStatus, response, dataBytes, statusBytes, error);
    }

    private static bool IsGeneralError(IReadOnlyList<byte> statusBytes)
    {
        if (statusBytes.Count != 6)
        {
            return false;
        }

        var status0 = Convert.ToString(statusBytes[0], 2).PadLeft(8, '0');
        var status2 = Convert.ToString(statusBytes[2], 2).PadLeft(8, '0');

        return status0[2] == '1' && status2[7] != '1';
    }
}
