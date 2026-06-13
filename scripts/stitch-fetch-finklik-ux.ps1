# Fetch Stitch screens: Finklik UX Redesign (9044165488203690133)
$ErrorActionPreference = "Stop"
$ApiKey = $env:STITCH_API_KEY
if (-not $ApiKey) {
    $mcpPath = Join-Path $env:USERPROFILE ".cursor\mcp.json"
    if (Test-Path $mcpPath) {
        $cfg = Get-Content $mcpPath -Raw | ConvertFrom-Json
        $ApiKey = $cfg.mcpServers.stitch.headers.'X-Goog-Api-Key'
    }
}
if (-not $ApiKey) { throw "STITCH_API_KEY not found in env or ~/.cursor/mcp.json" }

$BaseUrl = "https://stitch.googleapis.com/mcp"
$ProjectId = "9044165488203690133"
$OutRoot = Join-Path $PSScriptRoot "..\docs\design\stitch\9044165488203690133"
New-Item -ItemType Directory -Force -Path $OutRoot | Out-Null

$screens = @(
    @{ id = "33bb3ae51425477d9c5812e9a6d658ab"; slug = "web/employees" },
    @{ id = "fa2fb5f0b1cd4b35b41db94a89dc439b"; slug = "web/home" },
    @{ id = "55007f045ab8432f8897648c07808efe"; slug = "web/login" },
    @{ id = "50e16161edfb4eb0832efbfc9119b7e1"; slug = "web/operation-details" },
    @{ id = "006684adeb434ab6ad90e7dadc782c79"; slug = "web/accounting" },
    @{ id = "e1f92c1e19874f8fa849903340d0dea9"; slug = "web/register" },
    @{ id = "a955a2440b17460b93c6bdfebda94ff7"; slug = "web/payroll" },
    @{ id = "284491824c414b459013f89e82ef9ac9"; slug = "web/employee-card" },
    @{ id = "702f6a00b5df4141995eb26f2ea76663"; slug = "web/new-counterparty" },
    @{ id = "67bb26b0c694472c82dc341052b548b0"; slug = "web/bank" },
    @{ id = "7f097783aa344dd18fb07e4d1914573a"; slug = "web/scanner" },
    @{ id = "eafe5d7021534656aaa1a725e16ce9a2"; slug = "web/error" },
    @{ id = "0d5d8c4b0ac94d7882bc6798bca14cae"; slug = "web/tasks" },
    @{ id = "d77f342e1c8c412da659e4383bfc8d50"; slug = "web/success" },
    @{ id = "86e9971517ca4494b04131a39189391c"; slug = "web/add-employee" },
    @{ id = "2c18ba4681a34f4a80d83563db8236b2"; slug = "web/fszn-reports" },
    @{ id = "87c22b2afda24d74b68544885a9f7ab4"; slug = "web/settings" },
    @{ id = "ee277a3b6d47426491a659f48ff26f18"; slug = "web/notes" },
    @{ id = "f38a6fcc58c34e6eaa59706a2b75c310"; slug = "web/taxes-accounting" },
    @{ id = "4f651944d06845ec8c0c51ef2d222b5d"; slug = "web/counterparties" },
    @{ id = "2a463146c8cb43c4a049409c10bf2a05"; slug = "web/password-reset" },
    @{ id = "4d1045ff15e74068ba18d5bd4aa9d7f0"; slug = "web/fszn-report-details" },
    @{ id = "4ffa265298344ef2828299f69bb70ef0"; slug = "web/operations-history" },
    @{ id = "bbcbeda7cf41412fb5db08d98e7566e3"; slug = "mobile/scanner-documents" },
    @{ id = "8c7a41eab9d842c0872d88dcf8b2e5d0"; slug = "mobile/employees" },
    @{ id = "43b6578310524b5e8c99296dc6779152"; slug = "mobile/home" },
    @{ id = "50c34155741445039b62ce97630b78d1"; slug = "mobile/scanner" },
    @{ id = "8576ff37a7e4405bb64043b00b5e0c3a"; slug = "mobile/tasks" },
    @{ id = "a0d7cd37c186443b9153e8fd7b8afe44"; slug = "mobile/success" },
    @{ id = "3a7e67ca894e40e2b4b85a34930f4ea9"; slug = "mobile/accounting" },
    @{ id = "fd480e6618434bd59d48810a1f661032"; slug = "mobile/counterparties" },
    @{ id = "b89fc65c993345debb0c99386a8435b8"; slug = "mobile/bank" },
    @{ id = "6ef12d00a7fc46a9a4f5528ffc37d651"; slug = "mobile/settings" },
    @{ id = "fc61008ca6a048398079df9e3ae66cf6"; slug = "mobile/login-confirm" },
    @{ id = "93439d6c7bb94ba9ae267325da28db56"; slug = "mobile/employee-card" },
    @{ id = "5a4a999297bc484a8f1426fb7c039433"; slug = "mobile/operation-details" },
    @{ id = "4340de21f92b49cc85955174d8165cfa"; slug = "mobile/new-counterparty" },
    @{ id = "c67567a8c59647649a6c15072fe2b862"; slug = "mobile/payroll" },
    @{ id = "6103454e7a8a4c60b8cc76d35629c543"; slug = "mobile/notes" },
    @{ id = "269fe4c60faf4106a9127ca0efb75df7"; slug = "mobile/password-reset" },
    @{ id = "072c83b3538d4f7182c0b3d2618f819e"; slug = "mobile/login" },
    @{ id = "1d0fddc5b30a414f9ce7085d30da80f9"; slug = "mobile/fszn-reports" },
    @{ id = "4fcd77bc538e43768bc5269d627c4886"; slug = "mobile/register" },
    @{ id = "3635d3d483ec4accaf73b09b515be8fe"; slug = "mobile/welcome" }
)

function Invoke-StitchRpc {
    param(
        [string]$Method,
        [hashtable]$Params,
        [int]$Id = 1,
        [string]$SessionId = $null
    )
    $body = @{
        jsonrpc = "2.0"
        id      = $Id
        method  = $Method
        params  = $Params
    } | ConvertTo-Json -Depth 20 -Compress

    $headers = @{
        "Content-Type"   = "application/json"
        "Accept"         = "application/json, text/event-stream"
        "X-Goog-Api-Key" = $ApiKey
    }
    if ($SessionId) { $headers["Mcp-Session-Id"] = $SessionId }

    $resp = Invoke-WebRequest -Uri $BaseUrl -Method POST -Headers $headers -Body $body -UseBasicParsing
    $text = $resp.Content
    if ($text -match '^event:\s*message\s*\r?\ndata:\s*(.+)$') {
        $text = $Matches[1]
    }
    elseif ($text -match '(?m)^data:\s*(.+)$') {
        $text = ($text -split "`n" | Where-Object { $_ -match '^data:\s*' } | ForEach-Object { $_ -replace '^data:\s*', '' }) -join ''
    }
    return [pscustomobject]@{
        Headers = $resp.Headers
        Json    = ($text | ConvertFrom-Json)
        Raw     = $text
    }
}

function Get-ScreenPayload {
    param([hashtable]$Screen, [int]$RpcId)
    $result = Call-Tool -Name "get_screen" -ToolArgs @{
        projectId = $ProjectId
        screenId  = $Screen.id
    } -RpcId $RpcId

    $structured = $result.structuredContent
    if (-not $structured) {
        $text = ($result.content | ForEach-Object { $_.text }) -join ""
        if ($text) { $structured = $text | ConvertFrom-Json }
    }
    if (-not $structured) { throw "Empty get_screen response" }
    return $structured
}

function Download-Url {
    param([string]$Url, [string]$OutPath)
    if (-not $Url) { throw "Missing download URL" }
    curl.exe -fsSL $Url -o $OutPath
    if (-not (Test-Path $OutPath) -or (Get-Item $OutPath).Length -lt 32) {
        throw "Download failed or file too small: $OutPath"
    }
}

Write-Host "Initializing MCP session..."
$init = Invoke-StitchRpc -Method "initialize" -Params @{
    protocolVersion = "2024-11-05"
    capabilities    = @{}
    clientInfo      = @{ name = "finklik-ux-fetch"; version = "1.0.0" }
}
$sessionId = $init.Headers["Mcp-Session-Id"]
if (-not $sessionId) { $sessionId = $init.Headers["mcp-session-id"] }
if ($sessionId -is [array]) { $sessionId = $sessionId[0] }
Write-Host "Session: $sessionId"

Invoke-StitchRpc -Method "notifications/initialized" -Params @{} -Id 2 -SessionId $sessionId | Out-Null

function Call-Tool {
    param([string]$Name, [hashtable]$ToolArgs, [int]$RpcId)
    $result = Invoke-StitchRpc -Method "tools/call" -Params @{
        name      = $Name
        arguments = $ToolArgs
    } -Id $RpcId -SessionId $sessionId
    return $result.Json.result
}

$manifest = @()
$rpcId = 10
$ok = 0
$fail = 0

foreach ($screen in $screens) {
    $dir = Join-Path $OutRoot $screen.slug
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    Write-Host "[$($screen.slug)] $($screen.id)..."

    $entry = @{
        screenId  = $screen.id
        slug      = $screen.slug
        projectId = $ProjectId
        ok        = $false
    }

    try {
        $payload = Get-ScreenPayload -Screen $screen -RpcId $rpcId
        $rpcId++

        $entry.title = $payload.title
        $entry.deviceType = $payload.deviceType
        $entry.width = $payload.width
        $entry.height = $payload.height

        Download-Url -Url $payload.htmlCode.downloadUrl -OutPath (Join-Path $dir "screen.html")
        Download-Url -Url $payload.screenshot.downloadUrl -OutPath (Join-Path $dir "screen.png")

        $entry.ok = $true
        $ok++
        Write-Host "  OK ($($payload.title))"
    }
    catch {
        $entry.error = $_.Exception.Message
        $fail++
        Write-Warning "  FAILED: $_"
    }

    $entry | ConvertTo-Json | Set-Content (Join-Path $dir "meta.json") -Encoding utf8
    $manifest += $entry
}

@{
    projectId    = $ProjectId
    projectTitle = "Finklik UX Redesign"
    fetchedAt    = (Get-Date).ToString("o")
    total        = $screens.Count
    ok           = $ok
    failed       = $fail
    screens      = $manifest
} | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $OutRoot "manifest.json") -Encoding utf8

Write-Host ""
Write-Host "Done: $ok OK, $fail failed"
Write-Host "Output: $OutRoot"
