param(
    [switch]$NoOpen
)

$ErrorActionPreference = "Stop"
$root = [IO.Path]::GetFullPath($PSScriptRoot)

function Open-Studio([string]$url) {
    if ($NoOpen) { return }
    $browsers = @(
        "C:\Program Files\Google\Chrome\Application\chrome.exe"
        "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
        "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
    )
    $browser = $browsers | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if ($browser) { Start-Process -FilePath $browser -ArgumentList $url }
    else { Start-Process $url }
}

# Raw-socket health probe: fast, and immune to system proxy settings that
# make Invoke-WebRequest's first request take seconds.
function Test-StudioHealth([int]$port) {
    $client = [Net.Sockets.TcpClient]::new()
    try {
        $pending = $client.BeginConnect("127.0.0.1", $port, $null, $null)
        if (-not $pending.AsyncWaitHandle.WaitOne(300)) { return $false }
        $client.EndConnect($pending)
        $client.ReceiveTimeout = 1500
        $client.SendTimeout = 1500
        $stream = $client.GetStream()
        $request = [Text.Encoding]::ASCII.GetBytes(
            "GET /__studio_health HTTP/1.1`r`nHost: localhost`r`nConnection: close`r`n`r`n"
        )
        $stream.Write($request, 0, $request.Length)
        $reader = [IO.StreamReader]::new($stream)
        return ($reader.ReadToEnd() -match "led-curve-studio")
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

# Reuse an already-running studio server so browser tabs keep a stable port.
foreach ($candidate in 8765..8775) {
    if (Test-StudioHealth $candidate) {
        $url = "http://localhost:$candidate/index.html"
        Write-Host ""
        Write-Host "LED Curve Studio is already running." -ForegroundColor Cyan
        Write-Host "Reusing: $url"
        Open-Studio $url
        exit 0
    }
}

$serverSource = @"
using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading.Tasks;

namespace LedCurveStudio
{
    public class StaticServer
    {
        private readonly TcpListener _listener;
        private readonly string _root;
        public readonly int Port;

        public StaticServer(string root, int port)
        {
            _root = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar);
            _listener = new TcpListener(IPAddress.Loopback, port);
            Port = port;
        }

        public void Start()
        {
            _listener.Start();
            Task.Run(new Func<Task>(AcceptLoop));
        }

        private async Task AcceptLoop()
        {
            while (true)
            {
                TcpClient client;
                try
                {
                    client = await _listener.AcceptTcpClientAsync().ConfigureAwait(false);
                }
                catch
                {
                    break;
                }
                // One task per connection: an idle or slow socket (for example a
                // browser preconnect that never sends a request) cannot block
                // any other request.
                Task ignored = Task.Run(delegate { HandleClient(client); });
            }
        }

        private void HandleClient(TcpClient client)
        {
            try
            {
                client.ReceiveTimeout = 5000;
                client.SendTimeout = 15000;
                using (NetworkStream stream = client.GetStream())
                {
                    string requestLine = ReadLine(stream);
                    if (string.IsNullOrEmpty(requestLine)) return;
                    string headerLine = ReadLine(stream);
                    while (!string.IsNullOrEmpty(headerLine))
                    {
                        headerLine = ReadLine(stream);
                    }

                    string[] parts = requestLine.Split(' ');
                    if (parts.Length < 2) return;
                    string method = parts[0];
                    string path = Uri.UnescapeDataString(parts[1].Split('?')[0]).TrimStart('/');
                    if (path.Length == 0) path = "index.html";

                    byte[] body;
                    string status;
                    string contentType;

                    if (path == "__studio_health")
                    {
                        body = Encoding.UTF8.GetBytes("led-curve-studio");
                        status = "200 OK";
                        contentType = "text/plain; charset=utf-8";
                    }
                    else if (method != "GET" && method != "HEAD")
                    {
                        body = Encoding.UTF8.GetBytes("Method not allowed");
                        status = "405 Method Not Allowed";
                        contentType = "text/plain; charset=utf-8";
                    }
                    else
                    {
                        string candidate = Path.GetFullPath(
                            Path.Combine(_root, path.Replace('/', Path.DirectorySeparatorChar)));
                        bool allowed = candidate.StartsWith(
                            _root + Path.DirectorySeparatorChar,
                            StringComparison.OrdinalIgnoreCase);
                        if (allowed && File.Exists(candidate))
                        {
                            body = File.ReadAllBytes(candidate);
                            status = "200 OK";
                            contentType = GetMime(Path.GetExtension(candidate).ToLowerInvariant());
                        }
                        else
                        {
                            body = Encoding.UTF8.GetBytes("Not found");
                            status = "404 Not Found";
                            contentType = "text/plain; charset=utf-8";
                        }
                    }

                    StringBuilder headers = new StringBuilder();
                    headers.Append("HTTP/1.1 ").Append(status).Append("\r\n");
                    headers.Append("Content-Type: ").Append(contentType).Append("\r\n");
                    headers.Append("Content-Length: ").Append(body.Length).Append("\r\n");
                    headers.Append("Cache-Control: no-store\r\n");
                    headers.Append("Permissions-Policy: usb=(self), serial=(self)\r\n");
                    headers.Append("Connection: close\r\n\r\n");
                    byte[] headerBytes = Encoding.ASCII.GetBytes(headers.ToString());
                    stream.Write(headerBytes, 0, headerBytes.Length);
                    if (method != "HEAD") stream.Write(body, 0, body.Length);
                    stream.Flush();
                }
            }
            catch
            {
                // Timeouts and aborted sockets are routine; drop the connection.
            }
            finally
            {
                client.Close();
            }
        }

        private static string ReadLine(NetworkStream stream)
        {
            StringBuilder text = new StringBuilder();
            while (true)
            {
                int value = stream.ReadByte();
                if (value == -1) return text.Length == 0 ? null : text.ToString();
                if (value == '\n') return text.ToString();
                if (value != '\r') text.Append((char)value);
                if (text.Length > 8192) return text.ToString();
            }
        }

        private static string GetMime(string extension)
        {
            switch (extension)
            {
                case ".html": return "text/html; charset=utf-8";
                case ".js": return "text/javascript; charset=utf-8";
                case ".css": return "text/css; charset=utf-8";
                case ".json": return "application/json; charset=utf-8";
                case ".bin": return "application/octet-stream";
                case ".ino": return "text/plain; charset=utf-8";
                case ".jpg":
                case ".jpeg": return "image/jpeg";
                case ".png": return "image/png";
                case ".gif": return "image/gif";
                case ".svg": return "image/svg+xml";
                case ".ico": return "image/x-icon";
                default: return "application/octet-stream";
            }
        }
    }
}
"@

Add-Type -TypeDefinition $serverSource -Language CSharp

$server = $null
foreach ($candidate in 8765..8775) {
    try {
        $server = [LedCurveStudio.StaticServer]::new($root, $candidate)
        $server.Start()
        break
    } catch {
        $server = $null
    }
}
if (-not $server) {
    throw "Could not find a free localhost port between 8765 and 8775."
}

$url = "http://localhost:$($server.Port)/index.html"
Write-Host ""
Write-Host "LED Curve Studio" -ForegroundColor Cyan
Write-Host "Serving: $url"
Write-Host "Keep this window open while programming from Chrome/Edge."
Write-Host "Press Ctrl+C to stop."
Write-Host ""
Open-Studio $url

while ($true) {
    Start-Sleep -Seconds 3600
}
