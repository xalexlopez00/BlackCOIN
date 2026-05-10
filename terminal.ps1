param(
    [string]$NodeUrl = "http://localhost:3001"
)

$ApiBase = "$NodeUrl/api/v1"
$token = $null
$currentUser = $null

function Show-Banner {
    Clear-Host
    Write-Host "+------------------------------------------+" -ForegroundColor Cyan
    Write-Host "|       BlackCOIN Interactive Terminal      |" -ForegroundColor Cyan
    Write-Host "|  Node: $NodeUrl" -ForegroundColor Cyan
    if ($currentUser) {
        $role = if ($currentUser.isAdmin) { "ADMIN" } else { "USER" }
        Write-Host "|  User: $($currentUser.username) [$role]" -ForegroundColor Cyan
    } else {
        Write-Host "|  Status: Not logged in" -ForegroundColor Yellow
    }
    Write-Host "+------------------------------------------+" -ForegroundColor Cyan
}

function Invoke-Api {
    param([string]$Method, [string]$Route, $Body, [bool]$Auth = $false)
    $uri = "$ApiBase$Route"
    $params = @{
        Method = $Method
        Uri = $uri
        ContentType = "application/json"
    }
    if ($Auth -and $token) {
        $params.Headers = @{ Authorization = "Bearer $token" }
    }
    if ($Body) {
        $params.Body = ($Body | ConvertTo-Json)
    }
    try {
        $response = Invoke-RestMethod @params
        return @{ Success = $true; Data = $response }
    } catch {
        $msg = $_.Exception.Message
        try { $err = $_ | ConvertFrom-Json; $msg = $err.error } catch {}
        return @{ Success = $false; Error = $msg }
    }
}

function Wait-Menu {
    Write-Host "`nPress ENTER to continue..." -NoNewline -ForegroundColor DarkGray
    $null = Read-Host
}

function Menu-Auth {
    Show-Banner
    Write-Host "`n--- AUTH ---" -ForegroundColor Magenta
    Write-Host "1. Login"
    Write-Host "2. Register"
    Write-Host "3. My profile"
    Write-Host "4. Logout"
    Write-Host "0. Back"
    $opt = Read-Host "`nSelect"
    switch ($opt) {
        "1" {
            $u = Read-Host "Username"
            $p = Read-Host "Password" -AsSecureString
            $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($p)
            $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
            $r = Invoke-Api -Method POST -Route "/auth/login" -Body @{ username = $u; password = $plain }
            if ($r.Success) {
                $token = $r.Data.token
                $me = Invoke-Api -Method GET -Route "/auth/me" -Auth $true
                if ($me.Success) { $currentUser = $me.Data }
                Write-Host "[OK] Login successful" -ForegroundColor Green
            } else { Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red }
            Wait-Menu
        }
        "2" {
            $u = Read-Host "Username"
            $p = Read-Host "Password" -AsSecureString
            $ac = Read-Host "Admin code (optional)"
            $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($p)
            $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
            $body = @{ username = $u; password = $plain }
            if ($ac) { $body.adminCode = $ac }
            $r = Invoke-Api -Method POST -Route "/auth/register" -Body $body
            if ($r.Success) {
                $token = $r.Data.token
                $me = Invoke-Api -Method GET -Route "/auth/me" -Auth $true
                if ($me.Success) { $currentUser = $me.Data }
                Write-Host "[OK] Registration successful" -ForegroundColor Green
            } else { Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red }
            Wait-Menu
        }
        "3" {
            if (!$token) { Write-Host "[ERROR] Not logged in" -ForegroundColor Red; Wait-Menu; break }
            $r = Invoke-Api -Method GET -Route "/auth/me" -Auth $true
            if ($r.Success) { Write-Host ($r.Data | Format-List | Out-String) } else { Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red }
            Wait-Menu
        }
        "4" {
            if ($token) {
                $r = Invoke-Api -Method POST -Route "/auth/logout" -Auth $true
            }
            $token = $null; $currentUser = $null
            Write-Host "[OK] Logged out" -ForegroundColor Green
            Wait-Menu
        }
    }
}

function Menu-Blockchain {
    Show-Banner
    Write-Host "`n--- BLOCKCHAIN ---" -ForegroundColor Magenta
    Write-Host "1. General info"
    Write-Host "2. View blocks (last 20)"
    Write-Host "3. View all blocks"
    Write-Host "4. View latest block"
    Write-Host "5. Find block by hash"
    Write-Host "6. Find block by index"
    Write-Host "7. View UTXOs"
    Write-Host "8. View pending transactions (pool)"
    Write-Host "9. Rich list (top 20)"
    Write-Host "10. Check address"
    Write-Host "0. Back"
    $opt = Read-Host "`nSelect"
    switch ($opt) {
        "1" { $r = Invoke-Api -Method GET -Route "/info"; if($r.Success){Write-Host ($r.Data | Format-List | Out-String)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}; Wait-Menu }
        "2" { $r = Invoke-Api -Method GET -Route "/blocks"; if($r.Success){Write-Host ($r.Data | ConvertTo-Json -Depth 3)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}; Wait-Menu }
        "3" { $r = Invoke-Api -Method GET -Route "/blocks/all"; if($r.Success){Write-Host ($r.Data | ConvertTo-Json -Depth 3)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}; Wait-Menu }
        "4" { $r = Invoke-Api -Method GET -Route "/blocks/latest"; if($r.Success){Write-Host ($r.Data | Format-List | Out-String)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}; Wait-Menu }
        "5" { $h = Read-Host "Hash"; $r = Invoke-Api -Method GET -Route "/blocks/hash/$h"; if($r.Success){Write-Host ($r.Data | Format-List | Out-String)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}; Wait-Menu }
        "6" { $i = Read-Host "Index"; $r = Invoke-Api -Method GET -Route "/blocks/index/$i"; if($r.Success){Write-Host ($r.Data | Format-List | Out-String)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}; Wait-Menu }
        "7" { $r = Invoke-Api -Method GET -Route "/utxos"; if($r.Success){Write-Host ($r.Data | ConvertTo-Json -Depth 2)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}; Wait-Menu }
        "8" { $r = Invoke-Api -Method GET -Route "/transaction-pool"; if($r.Success){Write-Host ($r.Data | ConvertTo-Json -Depth 2)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}; Wait-Menu }
        "9" { $r = Invoke-Api -Method GET -Route "/richlist"; if($r.Success){Write-Host ($r.Data | ConvertTo-Json -Depth 2)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}; Wait-Menu }
        "10" { $a = Read-Host "Address"; $r = Invoke-Api -Method GET -Route "/address/$a"; if($r.Success){Write-Host ($r.Data | Format-List | Out-String)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}; Wait-Menu }
    }
}

function Menu-Wallets {
    Show-Banner
    Write-Host "`n--- WALLETS ---" -ForegroundColor Magenta
    Write-Host "1. List wallets"
    Write-Host "2. Create wallet"
    Write-Host "3. Check balance"
    Write-Host "4. Export private key"
    Write-Host "5. Import wallet (private key)"
    Write-Host "6. Send transaction"
    Write-Host "7. Mine block"
    Write-Host "0. Back"
    $opt = Read-Host "`nSelect"
    switch ($opt) {
        "1" { $r = Invoke-Api -Method GET -Route "/wallets"; if($r.Success){Write-Host ($r.Data | ConvertTo-Json -Depth 2)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}; Wait-Menu }
        "2" {
            $n = Read-Host "Wallet name"
            $p = Read-Host "Password" -AsSecureString
            $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($p)
            $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
            $r = Invoke-Api -Method POST -Route "/wallets/create" -Body @{ name = $n; password = $plain }
            if($r.Success){Write-Host ($r.Data | Format-List | Out-String)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}
            Wait-Menu
        }
        "3" { $a = Read-Host "Address"; $r = Invoke-Api -Method GET -Route "/wallets/$a/balance"; if($r.Success){Write-Host ($r.Data | Format-List | Out-String)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}; Wait-Menu }
        "4" {
            $wid = Read-Host "Wallet ID"
            $p = Read-Host "Password" -AsSecureString
            $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($p)
            $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
            $r = Invoke-Api -Method POST -Route "/wallets/export" -Body @{ walletId = $wid; password = $plain }
            if($r.Success){Write-Host ($r.Data | Format-List | Out-String)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}
            Wait-Menu
        }
        "5" {
            $pk = Read-Host "Private key (64 hex)"
            $n = Read-Host "Name"
            $p = Read-Host "Password" -AsSecureString
            $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($p)
            $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
            $r = Invoke-Api -Method POST -Route "/wallets/import" -Body @{ privateKey = $pk; name = $n; password = $plain }
            if($r.Success){Write-Host ($r.Data | Format-List | Out-String)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}
            Wait-Menu
        }
        "6" {
            $to = Read-Host "Destination (address or @name)"
            $amt = Read-Host "Amount"
            $msg = Read-Host "Message (optional)"
            Write-Host "Auth options:" -ForegroundColor Yellow
            Write-Host "1. Use walletId + password"
            Write-Host "2. Use private key directly"
            $authOpt = Read-Host "Select"
            $body = @{ to = $to; amount = [double]$amt }
            if ($msg) { $body.message = $msg }
            if ($authOpt -eq "1") {
                $wid = Read-Host "Wallet ID"
                $p = Read-Host "Password" -AsSecureString
                $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($p)
                $body.walletId = $wid; $body.password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
            } else {
                $body.privateKey = Read-Host "Private key (64 hex)"
            }
            $r = Invoke-Api -Method POST -Route "/transactions/send" -Body $body
            if($r.Success){Write-Host ($r.Data | Format-List | Out-String)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}
            Wait-Menu
        }
        "7" {
            $addr = Read-Host "Miner address (reward)"
            $r = Invoke-Api -Method POST -Route "/mine" -Body @{ minerAddress = $addr }
            if($r.Success){Write-Host ($r.Data | Format-List | Out-String)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}
            Wait-Menu
        }
    }
}

function Menu-Admin {
    if (!$currentUser.isAdmin) {
        Write-Host "[ERROR] Only administrators can use this section" -ForegroundColor Red; Wait-Menu; return
    }
    Show-Banner
    Write-Host "`n--- ADMIN ---" -ForegroundColor Magenta
    Write-Host "1. List users"
    Write-Host "2. Make admin (admin:add)"
    Write-Host "3. Remove admin (admin:remove)"
    Write-Host "4. Reset user password"
    Write-Host "5. Delete user"
    Write-Host "6. View support tickets"
    Write-Host "7. Reply to ticket"
    Write-Host "8. Close ticket"
    Write-Host "9. Delete ticket"
    Write-Host "10. View settings"
    Write-Host "11. View persisted peers"
    Write-Host "12. Cleanup dead peers"
    Write-Host "0. Back"
    $opt = Read-Host "`nSelect"
    switch ($opt) {
        "1" { $r = Invoke-Api -Method GET -Route "/admin/users" -Auth $true; if($r.Success){Write-Host ($r.Data | ConvertTo-Json -Depth 2)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}; Wait-Menu }
        "2" { $u = Read-Host "Username"; $r = Invoke-Api -Method POST -Route "/admin/promote" -Body @{username=$u} -Auth $true; if($r.Success){Write-Host "[OK] $u is now admin" -ForegroundColor Green}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}; Wait-Menu }
        "3" { $u = Read-Host "Username"; $r = Invoke-Api -Method POST -Route "/admin/demote" -Body @{username=$u} -Auth $true; if($r.Success){Write-Host "[OK] $u is no longer admin" -ForegroundColor Green}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}; Wait-Menu }
        "4" {
            $u = Read-Host "Username"
            $p = Read-Host "New password" -AsSecureString
            $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($p)
            $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
            $r = Invoke-Api -Method POST -Route "/admin/reset-password" -Body @{username=$u;newPassword=$plain} -Auth $true
            if($r.Success){Write-Host "[OK] Password for $u updated" -ForegroundColor Green}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}
            Wait-Menu
        }
        "5" { $u = Read-Host "Username"; $r = Invoke-Api -Method DELETE -Route "/admin/users/$u" -Auth $true; if($r.Success){Write-Host "[OK] $u deleted" -ForegroundColor Green}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}; Wait-Menu }
        "6" { $r = Invoke-Api -Method GET -Route "/admin/tickets" -Auth $true; if($r.Success){Write-Host ($r.Data | ConvertTo-Json -Depth 3)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}; Wait-Menu }
        "7" {
            $id = Read-Host "Ticket ID"
            $reply = Read-Host "Reply message"
            $close = Read-Host "Close after reply? (y/N)"
            $closeAfter = $close -eq "y"
            $r = Invoke-Api -Method POST -Route "/support/tickets/$id/reply" -Body @{reply=$reply;closeAfterReply=$closeAfter} -Auth $true
            if($r.Success){Write-Host "[OK] Replied" -ForegroundColor Green}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}
            Wait-Menu
        }
        "8" { $id = Read-Host "Ticket ID"; $r = Invoke-Api -Method POST -Route "/support/tickets/$id/close" -Auth $true; if($r.Success){Write-Host "[OK] Ticket $id closed" -ForegroundColor Green}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}; Wait-Menu }
        "9" { $id = Read-Host "Ticket ID"; $r = Invoke-Api -Method DELETE -Route "/support/tickets/$id" -Auth $true; if($r.Success){Write-Host "[OK] Ticket $id deleted" -ForegroundColor Green}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}; Wait-Menu }
        "10" { $r = Invoke-Api -Method GET -Route "/admin/settings" -Auth $true; if($r.Success){Write-Host ($r.Data | ConvertTo-Json -Depth 2)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}; Wait-Menu }
        "11" { $r = Invoke-Api -Method GET -Route "/admin/peers" -Auth $true; if($r.Success){Write-Host ($r.Data | ConvertTo-Json -Depth 2)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}; Wait-Menu }
        "12" { $r = Invoke-Api -Method POST -Route "/admin/peers/cleanup" -Auth $true; if($r.Success){Write-Host ($r.Data | Format-List | Out-String)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}; Wait-Menu }
    }
}

function Menu-Names {
    Show-Banner
    Write-Host "`n--- NAMES (CNS .pro) ---" -ForegroundColor Magenta
    Write-Host "1. List names"
    Write-Host "2. Register name"
    Write-Host "3. Resolve name -> address"
    Write-Host "4. Lookup address -> name"
    Write-Host "0. Back"
    $opt = Read-Host "`nSelect"
    switch ($opt) {
        "1" { $r = Invoke-Api -Method GET -Route "/names"; if($r.Success){Write-Host ($r.Data | ConvertTo-Json -Depth 2)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}; Wait-Menu }
        "2" {
            $n = Read-Host "Name (without .pro)"
            $a = Read-Host "Address"
            $r = Invoke-Api -Method POST -Route "/names/register" -Body @{name=$n;address=$a}
            if($r.Success){Write-Host "[OK] Name $n registered" -ForegroundColor Green}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}
            Wait-Menu
        }
        "3" { $n = Read-Host "Name"; $r = Invoke-Api -Method GET -Route "/names/resolve/$n"; if($r.Success){Write-Host ($r.Data | Format-List | Out-String)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}; Wait-Menu }
        "4" { $a = Read-Host "Address"; $r = Invoke-Api -Method GET -Route "/names/lookup/$a"; if($r.Success){Write-Host ($r.Data | Format-List | Out-String)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}; Wait-Menu }
    }
}

function Menu-Support {
    Show-Banner
    Write-Host "`n--- SUPPORT ---" -ForegroundColor Magenta
    Write-Host "1. Create ticket"
    Write-Host "2. My tickets"
    Write-Host "3. View ticket"
    Write-Host "4. Reopen ticket"
    Write-Host "0. Back"
    $opt = Read-Host "`nSelect"
    switch ($opt) {
        "1" {
            if (!$token) { Write-Host "[ERROR] You must login first" -ForegroundColor Red; Wait-Menu; break }
            $subj = Read-Host "Subject (optional)"
            $msg = Read-Host "Message (optional)"
            $txId = Read-Host "Transaction ID (optional)"
            $body = @{}
            if ($subj) { $body.subject = $subj }
            if ($msg) { $body.message = $msg }
            if ($txId) { $body.txId = $txId }
            $r = Invoke-Api -Method POST -Route "/support/ticket" -Body $body -Auth $true
            if($r.Success){Write-Host ($r.Data | Format-List | Out-String)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}
            Wait-Menu
        }
        "2" {
            if (!$token) { Write-Host "[ERROR] You must login first" -ForegroundColor Red; Wait-Menu; break }
            $r = Invoke-Api -Method GET -Route "/support/tickets" -Auth $true
            if($r.Success){Write-Host ($r.Data | ConvertTo-Json -Depth 3)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}
            Wait-Menu
        }
        "3" {
            if (!$token) { Write-Host "[ERROR] You must login first" -ForegroundColor Red; Wait-Menu; break }
            $id = Read-Host "Ticket ID"
            $r = Invoke-Api -Method GET -Route "/support/tickets/$id" -Auth $true
            if($r.Success){Write-Host ($r.Data | Format-List | Out-String)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}
            Wait-Menu
        }
        "4" {
            if (!$token) { Write-Host "[ERROR] You must login first" -ForegroundColor Red; Wait-Menu; break }
            $id = Read-Host "Ticket ID"
            $r = Invoke-Api -Method POST -Route "/support/tickets/$id/reopen" -Auth $true
            if($r.Success){Write-Host "[OK] Ticket $id reopened" -ForegroundColor Green}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}
            Wait-Menu
        }
    }
}

function Menu-Peers {
    Show-Banner
    Write-Host "`n--- PEERS ---" -ForegroundColor Magenta
    Write-Host "1. View connected peers"
    Write-Host "2. Connect to peers"
    Write-Host "0. Back"
    $opt = Read-Host "`nSelect"
    switch ($opt) {
        "1" { $r = Invoke-Api -Method GET -Route "/peers"; if($r.Success){Write-Host ($r.Data | ConvertTo-Json -Depth 2)}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}; Wait-Menu }
        "2" {
            $peersStr = Read-Host "Peers (comma separated, e.g. localhost:6002,192.168.1.5:6003)"
            $peersArr = @($peersStr -split ',' | ForEach-Object { $_.Trim() })
            $r = Invoke-Api -Method POST -Route "/peers/connect" -Body @{peers=$peersArr}
            if($r.Success){Write-Host "[OK] Connected to peers" -ForegroundColor Green}else{Write-Host "[ERROR] $($r.Error)" -ForegroundColor Red}
            Wait-Menu
        }
    }
}

function Show-MainMenu {
    Show-Banner
    Write-Host "`n--- MAIN MENU ---" -ForegroundColor Yellow
    Write-Host " 1.  Auth (login / register)"
    Write-Host " 2.  Blockchain (info, blocks, UTXOs)"
    Write-Host " 3.  Wallets (create, balance, send, mine)"
    Write-Host " 4.  Admin (users, tickets, settings)"
    Write-Host " 5.  Names CNS .pro"
    Write-Host " 6.  Support (tickets)"
    Write-Host " 7.  Peers"
    Write-Host "`n 0.  Exit"
    Write-Host "`n>> Once logged in as admin, use option 4 to access admin commands like admin:add" -ForegroundColor DarkGray
}

while ($true) {
    Show-MainMenu
    $opt = Read-Host "`nSelect"
    switch ($opt) {
        "1" { Menu-Auth }
        "2" { Menu-Blockchain }
        "3" { Menu-Wallets }
        "4" { Menu-Admin }
        "5" { Menu-Names }
        "6" { Menu-Support }
        "7" { Menu-Peers }
        "0" { Write-Host "Goodbye!" -ForegroundColor Cyan; exit }
        default { Write-Host "Invalid option" -ForegroundColor Red; Start-Sleep -Milliseconds 500 }
    }
}
