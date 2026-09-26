$ErrorActionPreference = 'Stop'

$firebaseConfig = Get-Content -Raw "$env:USERPROFILE\.config\configstore\firebase-tools.json" | ConvertFrom-Json
$headers = @{ Authorization = "Bearer $($firebaseConfig.tokens.access_token)"; 'Content-Type' = 'application/json' }
$serviceEmail = 'firebase-adminsdk-fbsvc@thalimitra-prod.iam.gserviceaccount.com'
$encodedEmail = [uri]::EscapeDataString($serviceEmail)
$keyBase = "https://iam.googleapis.com/v1/projects/thalimitra-prod/serviceAccounts/$encodedEmail/keys"
$oldUserKeys = @((Invoke-RestMethod -Headers $headers -Uri $keyBase).keys |
  Where-Object keyType -eq 'USER_MANAGED' | ForEach-Object name)
$newKeyName = $null
$tempEnv = [IO.Path]::Combine([IO.Path]::GetTempPath(), "thalimitra-notifications-$([guid]::NewGuid().ToString('N')).env")

try {
  $keyResponse = Invoke-RestMethod -Headers $headers -Uri $keyBase -Method Post -Body '{"privateKeyType":"TYPE_GOOGLE_CREDENTIALS_FILE"}'
  $newKeyName = $keyResponse.name
  $rawJson = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($keyResponse.privateKeyData))
  $compactJson = ($rawJson | ConvertFrom-Json | ConvertTo-Json -Compress -Depth 10)
  $bytes = New-Object byte[] 48
  [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  $workerSecret = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
  [IO.File]::WriteAllText($tempEnv, "FIREBASE_SERVICE_ACCOUNT_JSON='$compactJson'`nNOTIFICATION_WORKER_SECRET=$workerSecret`n", [Text.UTF8Encoding]::new($false))

  & npx.cmd --yes supabase@2.118.0 secrets set --project-ref boeceqmjrnxpkmhppblq --env-file $tempEnv | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Supabase secret upload failed' }

  $sql = "select vault.create_secret('$workerSecret','notification_worker_key','Notification worker invocation key');"
  & npx.cmd --yes supabase@2.118.0 db query --linked $sql | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Supabase Vault setup failed' }

  foreach ($oldKey in $oldUserKeys) {
    Invoke-RestMethod -Headers $headers -Uri "https://iam.googleapis.com/v1/$oldKey" -Method Delete | Out-Null
  }
  try {
    Invoke-RestMethod -Headers $headers -Uri 'https://serviceusage.googleapis.com/v1/projects/117653049490/services/fcm.googleapis.com:enable' -Method Post -Body '{}' | Out-Null
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 409) { throw }
  }
  Write-Output 'Notification provider secrets configured.'
} catch {
  if ($newKeyName) {
    try { Invoke-RestMethod -Headers $headers -Uri "https://iam.googleapis.com/v1/$newKeyName" -Method Delete | Out-Null } catch {}
  }
  throw
} finally {
  if ([IO.File]::Exists($tempEnv)) { [IO.File]::Delete($tempEnv) }
  $rawJson=$null; $compactJson=$null; $workerSecret=$null; $bytes=$null; $keyResponse=$null
}
