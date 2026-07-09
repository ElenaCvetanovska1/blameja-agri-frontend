using System.Globalization;
using System.Text;

namespace Blameja.FiscalBridge.Protocol;

public static class AccentProtocol
{
    public static readonly Encoding Cp1251 = Encoding.GetEncoding(1251);

    public static byte[] EncodePayload(string? payloadText)
    {
        return payloadText is null ? [] : Cp1251.GetBytes(payloadText);
    }

    public static string ToHex(IEnumerable<byte> bytes)
    {
        return string.Join(' ', bytes.Select(b => b.ToString("X2", CultureInfo.InvariantCulture)));
    }

    public static string FormatPrice(decimal value)
    {
        return value.ToString("0.00", CultureInfo.InvariantCulture);
    }

    public static string FormatQuantity(decimal value)
    {
        return value.ToString("0.000", CultureInfo.InvariantCulture);
    }

    public static char ToVatChar(AccentVatGroup vatGroup)
    {
        return vatGroup switch
        {
            AccentVatGroup.A => 'А',
            AccentVatGroup.B => 'Б',
            AccentVatGroup.V => 'В',
            AccentVatGroup.G => 'Г',
            _ => throw new ArgumentOutOfRangeException(nameof(vatGroup), vatGroup, null)
        };
    }

    public static char ToPaymentChar(AccentPaymentMethod paymentMethod)
    {
        return paymentMethod switch
        {
            AccentPaymentMethod.Cash => 'P',
            AccentPaymentMethod.Credit => 'N',
            AccentPaymentMethod.Check => 'C',
            AccentPaymentMethod.Debit => 'D',
            _ => throw new ArgumentOutOfRangeException(nameof(paymentMethod), paymentMethod, null)
        };
    }
}
