using Npgsql;
using System.Data;

namespace Blameja.Api.Infrastructure.Database;

/// <summary>
/// Opens a new Npgsql connection each time it is called.
/// Inject this into services/controllers; callers are responsible for disposal.
/// </summary>
public sealed class DbConnectionFactory(string connectionString)
{
    public IDbConnection CreateConnection() => new NpgsqlConnection(connectionString);
}
