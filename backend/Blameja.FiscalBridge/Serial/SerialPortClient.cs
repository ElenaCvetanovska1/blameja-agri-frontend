using System.Diagnostics;
using System.IO.Ports;
using Blameja.FiscalBridge.Options;
using Blameja.FiscalBridge.Protocol;
using Microsoft.Extensions.Options;

namespace Blameja.FiscalBridge.Serial;

public sealed class SerialPortClient(
    IOptions<FiscalBridgeOptions> options,
    ILogger<SerialPortClient> logger) : ISerialPortClient
{
    private const byte StartByte = 0x01;
    private const byte EndByte = 0x03;
    private const byte NakByte = 0x15;
    private const byte SynByte = 0x16;

    private readonly SemaphoreSlim _serialLock = new(1, 1);

    public IReadOnlyList<string> GetPortNames()
    {
        try
        {
            return SerialPort.GetPortNames().Order(StringComparer.OrdinalIgnoreCase).ToArray();
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            logger.LogWarning(ex, "Failed to enumerate serial ports.");
            return [];
        }
    }

    public async Task<SerialCommandResult> SendAsync(byte[] requestBytes, CancellationToken cancellationToken)
    {
        await _serialLock.WaitAsync(cancellationToken);
        try
        {
            return SendLocked(requestBytes);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        finally
        {
            _serialLock.Release();
        }
    }

    private SerialCommandResult SendLocked(byte[] requestBytes)
    {
        var currentOptions = options.Value;
        var stopwatch = Stopwatch.StartNew();

        try
        {
            using var port = new SerialPort
            {
                PortName = currentOptions.ComPort,
                BaudRate = currentOptions.BaudRate,
                DataBits = currentOptions.DataBits,
                Parity = ParseEnum(currentOptions.Parity, Parity.None),
                StopBits = ParseEnum(currentOptions.StopBits, StopBits.One),
                Handshake = ParseEnum(currentOptions.Handshake, Handshake.None),
                ReadTimeout = currentOptions.ReadTimeoutMs,
                WriteTimeout = currentOptions.WriteTimeoutMs
            };

            port.Open();
            port.DiscardInBuffer();
            port.DiscardOutBuffer();
            port.Write(requestBytes, 0, requestBytes.Length);

            return ReadResponse(port, currentOptions.OverallReadTimeoutMs, stopwatch);
        }
        catch (Exception ex) when (ex is UnauthorizedAccessException or IOException or TimeoutException or ArgumentException or InvalidOperationException)
        {
            stopwatch.Stop();
            logger.LogWarning(ex, "Serial command failed on {ComPort}.", currentOptions.ComPort);

            return new SerialCommandResult(
                AccentResponseStatus.SERIAL_ERROR,
                [],
                stopwatch.ElapsedMilliseconds,
                ex.Message);
        }
    }

    private static SerialCommandResult ReadResponse(SerialPort port, int overallReadTimeoutMs, Stopwatch stopwatch)
    {
        var deadline = DateTimeOffset.UtcNow.AddMilliseconds(overallReadTimeoutMs);
        var frame = new List<byte>();
        var insideFrame = false;
        var garbageBytes = 0;

        while (DateTimeOffset.UtcNow < deadline)
        {
            int value;
            try
            {
                value = port.ReadByte();
            }
            catch (TimeoutException)
            {
                continue;
            }

            var current = (byte)value;

            if (current == NakByte)
            {
                stopwatch.Stop();
                return new SerialCommandResult(
                    AccentResponseStatus.NAK_RECEIVED,
                    [NakByte],
                    stopwatch.ElapsedMilliseconds,
                    "Device returned NAK.");
            }

            if (current == SynByte)
            {
                continue;
            }

            if (current == StartByte)
            {
                frame.Clear();
                frame.Add(current);
                insideFrame = true;
                garbageBytes = 0;
                continue;
            }

            if (!insideFrame)
            {
                garbageBytes++;
                if (garbageBytes >= 1000)
                {
                    stopwatch.Stop();
                    return new SerialCommandResult(
                        AccentResponseStatus.INVALID_RESPONSE,
                        [],
                        stopwatch.ElapsedMilliseconds,
                        "Received too many bytes before response start byte.");
                }

                continue;
            }

            frame.Add(current);
            if (current == EndByte)
            {
                stopwatch.Stop();
                return new SerialCommandResult(
                    AccentResponseStatus.OK,
                    [.. frame],
                    stopwatch.ElapsedMilliseconds,
                    null);
            }
        }

        stopwatch.Stop();
        return new SerialCommandResult(
            AccentResponseStatus.TIMEOUT_READING,
            [.. frame],
            stopwatch.ElapsedMilliseconds,
            "Timed out before a full response frame was received.");
    }

    private static TEnum ParseEnum<TEnum>(string? value, TEnum fallback)
        where TEnum : struct
    {
        return Enum.TryParse<TEnum>(value, ignoreCase: true, out var parsed)
            ? parsed
            : fallback;
    }
}
