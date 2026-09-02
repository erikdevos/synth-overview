param(
    [Parameter(Mandatory=$true)][string]$Src,
    [Parameter(Mandatory=$true)][string]$Dst
)

Add-Type -AssemblyName System.Runtime.WindowsRuntime

Function Await($WinRtTask, $ResultType) {
    $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
    $asTaskGeneric = $asTask.MakeGenericMethod($ResultType)
    $task = $asTaskGeneric.Invoke($null, @($WinRtTask))
    $task.Wait(-1) | Out-Null
    return $task.Result
}
Function AwaitAction($WinRtTask) {
    $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' } | Select-Object -First 1
    $task = $asTask.Invoke($null, @($WinRtTask))
    $task.Wait(-1) | Out-Null
}

[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapEncoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime] | Out-Null
[Windows.Storage.Streams.RandomAccessStream,Windows.Storage.Streams,ContentType=WindowsRuntime] | Out-Null

$srcFile = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($Src)) ([Windows.Storage.StorageFile])
$inStream = Await ($srcFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($inStream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$pixelData = Await ($decoder.GetPixelDataAsync()) ([Windows.Graphics.Imaging.PixelDataProvider])
$bytes = $pixelData.DetachPixelData()

$parent = Split-Path $Dst -Parent
$name = Split-Path $Dst -Leaf
if (Test-Path $Dst) { Remove-Item $Dst -Force }
$folder = Await ([Windows.Storage.StorageFolder]::GetFolderFromPathAsync($parent)) ([Windows.Storage.StorageFolder])
$dstFile = Await ($folder.CreateFileAsync($name, [Windows.Storage.CreationCollisionOption]::ReplaceExisting)) ([Windows.Storage.StorageFile])
$outStream = Await ($dstFile.OpenAsync([Windows.Storage.FileAccessMode]::ReadWrite)) ([Windows.Storage.Streams.IRandomAccessStream])

$encoderId = [Windows.Graphics.Imaging.BitmapEncoder]::JpegEncoderId
$encoder = Await ([Windows.Graphics.Imaging.BitmapEncoder]::CreateAsync($encoderId, $outStream)) ([Windows.Graphics.Imaging.BitmapEncoder])
$encoder.SetPixelData($decoder.BitmapPixelFormat, $decoder.BitmapAlphaMode, $decoder.PixelWidth, $decoder.PixelHeight, $decoder.DpiX, $decoder.DpiY, $bytes)
AwaitAction ($encoder.FlushAsync())
$outStream.Dispose()
$inStream.Dispose()

Write-Output "Converted: $Dst ($($decoder.PixelWidth)x$($decoder.PixelHeight))"
