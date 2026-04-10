$root = $PSScriptRoot
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:8080/")
$listener.Start()
Write-Host "Serving on http://localhost:8080"

$mimeTypes = @{
    ".html" = "text/html;charset=utf-8"
    ".css"  = "text/css;charset=utf-8"
    ".js"   = "application/javascript;charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".json" = "application/json"
    ".md"   = "text/plain;charset=utf-8"
}

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $path = $ctx.Request.Url.LocalPath
    if ($path -eq "/") { $path = "/index.html" }
    $file = Join-Path $root ($path -replace "/", "\")
    $ext = [System.IO.Path]::GetExtension($file)

    if (Test-Path $file) {
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $ctx.Response.ContentType = if ($mimeTypes[$ext]) { $mimeTypes[$ext] } else { "application/octet-stream" }
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $ctx.Response.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
        $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
    }
    $ctx.Response.Close()
}
