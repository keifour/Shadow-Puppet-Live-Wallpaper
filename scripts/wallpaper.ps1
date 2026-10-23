param(
    [Parameter(Mandatory=$true)][long]$WindowHandle,
    [ValidateSet('0','1')][string]$Attach = '1',
    [int]$Left = 0, [int]$Top = 0, [int]$Width = 0, [int]$Height = 0
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = [Console]::OutputEncoding
try {
    Add-Type -Path (Join-Path $PSScriptRoot 'DesktopHost.cs')
    $mode = [DesktopHost]::Apply([IntPtr]$WindowHandle, $Attach -eq '1', $Left, $Top, $Width, $Height)
    [Console]::WriteLine((@{ ok = $true; mode = $mode } | ConvertTo-Json -Compress))
    exit 0
} catch {
    $errorObject = $_.Exception
    while ($errorObject.InnerException) { $errorObject = $errorObject.InnerException }
    $code = 'HELPER_FAILED'
    if ($errorObject.PSObject.Properties['Code']) { $code = $errorObject.Code }
    [Console]::WriteLine((@{ ok = $false; code = $code; message = $errorObject.Message } | ConvertTo-Json -Compress))
    exit 1
}
