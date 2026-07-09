namespace Blameja.FiscalBridge.Protocol;

public sealed class AccentSequenceGenerator
{
    private readonly Lock _lock = new();
    private int _value = 32;

    public byte Next()
    {
        lock (_lock)
        {
            _value++;
            if (_value > 127)
            {
                _value = 33;
            }

            return (byte)_value;
        }
    }
}
