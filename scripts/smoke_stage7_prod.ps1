# Smoke checks for Stage 7 security endpoints (production or staging URL).
# Usage:
#   pwsh scripts/smoke_stage7_prod.ps1
#   pwsh scripts/smoke_stage7_prod.ps1 -BaseUrl https://your-api.example.com

param(
    [string]$BaseUrl = 'https://finklik-api.onrender.com'
)

$ErrorActionPreference = 'Continue'

function Test-HttpCode {
    param([string]$Label, [string[]]$CurlArgs)
    $code = & curl.exe @CurlArgs
    Write-Host ("{0,-26} HTTP {1}" -f $Label, $code)
}

Write-Host "BASE $BaseUrl"
Write-Host "---"
Test-HttpCode "health" @('-s', '-o', 'NUL', '-w', '%{http_code}', "$BaseUrl/health")
Test-HttpCode "api_health" @('-s', '-o', 'NUL', '-w', '%{http_code}', "$BaseUrl/api/v1/health")
Test-HttpCode "jwt_query_block" @('-s', '-o', 'NUL', '-w', '%{http_code}', "$BaseUrl/health?access_token=fake")
Test-HttpCode "refresh_no_body" @('-s', '-o', 'NUL', '-w', '%{http_code}', '-X', 'POST', "$BaseUrl/api/v1/auth/refresh")
Write-Host "---"
Write-Host "Expected after deploy PR #2 fix:"
Write-Host "  jwt_query_block       HTTP 400"
Write-Host "  refresh_no_body       HTTP 401"
