FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
USER $APP_UID

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src

COPY ["Blameja.Api.csproj", "./"]
RUN dotnet restore "Blameja.Api.csproj"

COPY . .
RUN dotnet publish "Blameja.Api.csproj" \
    --configuration $BUILD_CONFIGURATION \
    --output /app/publish \
    /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Blameja.Api.dll"]