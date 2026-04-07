# BACKEND BUILD SPEC - KEYBRIX

## 1. Cel dokumentu

Ten dokument opisuje bardzo szczegolowo, co trzeba zbudowac po stronie backendu (Electron Main + warstwa IPC + runtime engine), aby frontend nie opieral sie na mock bridge i mial pelny, stabilny, produkcyjny przeplyw danych.

Zakres obejmuje:
- implementacje wszystkich kontraktow z [src/shared/api.ts](src/shared/api.ts),
- usuniecie logiki mockowej z [src/preload/index.ts](src/preload/index.ts),
- budowe rzeczywistej logiki domenowej w [src/main](src/main),
- zapewnienie jakosci: walidacja, testy, obserwowalnosc, bezpieczenstwo.

## 2. Stan obecny (as-is)

### 2.1 Co dziala realnie w Main

1. Persistencja i odczyt ustawien przez [src/main/services/settings.service.ts](src/main/services/settings.service.ts).
2. Czesciowe IPC dla settings i notyfikacji w [src/main/index.ts](src/main/index.ts).
3. Integracja z tray, startup i nativeTheme po stronie Main.

### 2.2 Co jest nadal mockiem

1. Makra (CRUD, run, toggle) sa realizowane in-memory w preload.
2. Logi i status systemu sa generowane timerami w preload.
3. Statystyki dashboard sa liczone z danych mockowych.
4. Nagrywanie skrotu jest symulowane i nie korzysta z rzeczywistego backendu skrótow.

### 2.3 Co jest stubem / no-op

1. [src/main/macro-runner/index.ts](src/main/macro-runner/index.ts) - no-op.
2. [src/main/keyboard/index.ts](src/main/keyboard/index.ts) - no-op.
3. [src/main/store/index.ts](src/main/store/index.ts) - no-op.

Wniosek: frontend korzysta z kontraktu backendowego, ale glowna logika biznesowa nadal siedzi w preload mock layer.

## 3. Docelowa architektura backendu (to-be)

## 3.1 Podzial odpowiedzialnosci

1. Main process:
- source of truth dla danych i runtime,
- IPC handlers,
- integracje systemowe (globalShortcut, tray, notification, startup, nativeTheme).

2. Preload:
- cienki, bezstanowy adapter IPC (context bridge),
- walidacja input/output na granicy,
- brak logiki biznesowej i brak timerow domenowych.

3. Shared:
- kontrakty zod + typy + nazwy kanalow IPC,
- schemy eventow i payloadow.

## 3.2 Moduly backendu do zbudowania

1. MacroRepository (persistencja makr).
2. MacroService (CRUD + zasady biznesowe).
3. ShortcutManager (rejestracja i odpinanie globalShortcut).
4. MacroRunner (wykonanie sekwencji komend).
5. LogsService (append/read/stream logow).
6. StatsService (metryki i agregaty dashboard).
7. SystemHealthService (status OPTIMAL/DEGRADED).
8. IpcController (rejestracja handlerow invoke + push channels).
9. EventBus wewnetrzny (opcjonalnie, ale zalecane).

## 4. Macierz kontraktow API i wymagan implementacyjnych

## 4.1 Namespace macros

### A. macros.getAll

Wymagane:
1. Odczyt makr z trwalego store.
2. Sortowanie stabilne (np. updatedAt desc lub manual order).
3. Walidacja wyjscia przez MacroSchema.

Braki teraz:
1. Dane sa z in-memory preload state.

### B. macros.getById

Wymagane:
1. Odczyt po id z repozytorium.
2. Null, gdy brak.
3. Walidacja danych i fallback migracyjny starszych payloadow blocksJson.

### C. macros.save

Wymagane:
1. Upsert makra (create gdy brak id, update gdy jest).
2. Ustalenie id (UUID) i metadanych (createdAt, updatedAt).
3. Walidacja inputu.
4. Re-register globalShortcut po zmianie shortcut lub isActive.
5. Konflikt shortcut:
- albo blad domenowy,
- albo auto-unregister starego i przypisanie nowemu (decyzja produktowa).
6. Emisja logu domenowego i odswiezenie statystyk.

### D. macros.delete

Wymagane:
1. Usuniecie z repozytorium.
2. Unregister shortcut dla usuwanego makra.
3. Return boolean czy cos usunieto.
4. Emisja logu i recalc stats.

### E. macros.toggle

Wymagane:
1. Zmiana isActive.
2. Respect globalMaster:
- gdy globalMaster=false i request isActive=true -> reject/false + log WARN.
3. Rejestracja/wyrejestrowanie globalShortcut.
4. Emisja system.macroStatusChanged.

### F. macros.run

Wymagane:
1. Uruchomienie MacroRunner po id.
2. Respect settings: globalMaster, delayMs, stopOnError.
3. Emisja statusow RUNNING/ACTIVE/IDLE.
4. Emisja logow RUN/INFO/WARN/ERR.
5. Trigger notyfikacji tylko gdy notifyOnMacroRun=true.
6. Polityka wspolbieznosci (single-flight per macro lub queue).

## 4.2 Namespace stats

### stats.get

Wymagane:
1. Agregacja:
- totalAutomations,
- activeNow,
- successRate,
- timeSavedMinutes.
2. Zrodla danych:
- makra,
- telemetry run results,
- counters przechowywane trwale.
3. Spojnosc z logika frontendu (wartosci nie moga skakac losowo).

## 4.3 Namespace logs

### A. logs.getRecent

Wymagane:
1. Odczyt ostatnich N wpisow (np. N=200).
2. Kolejnosc malejaca po czasie.
3. Ograniczenie rozmiaru bufora (retencja).

### B. logs.new-log (push)

Wymagane:
1. Broadcast event do rendererow przy nowym wpisie.
2. Stabilny format timestamp i poziomow.
3. Odporne na to, ze okno jest zamkniete/ukryte.

## 4.4 Namespace system

### A. system.statusUpdate (push)

Wymagane:
1. Serwis health check (interwal + heurystyki).
2. Emisja OPTIMAL/DEGRADED na podstawie metryk (CPU, event loop lag, memory).
3. Debounce zmian statusu, aby nie migotalo.

### B. system.macroStatusChanged (push)

Wymagane:
1. Emisja z realnego runtime: start, stop, fail, pause (jesli wspierane).
2. Powiazanie z konkretnym macro id.

## 4.5 Namespace keyboard

### keyboard.recordShortcut

Wymagane:
1. Walidacja i normalizacja reprezentacji klawiszy.
2. (Opcjonalnie) konflikt check vs istniejace makra.
3. Persistency policy:
- tylko pomocniczy telemetry log,
- albo realna rezerwacja shortcut juz na etapie nagrania.
4. Obecnie endpoint sluzy glownie do logu; decyzja czy rozszerzamy semantyke.

## 4.6 Namespace settings

Obecnie glownie dziala, ale backend trzeba dopiac produktowo:

1. settings.get:
- juz dziala,
- zachowac migracje defaults i walidacje.

2. settings.update:
- juz dziala,
- utrzymac atomowosc i side effects:
	- launchAtStartup,
	- themeMode,
	- tray sync,
	- (docelowo) live wplyw na runtime engine.

3. Powiazanie settings z runtime:
- globalMaster natychmiast zatrzymuje aktywne makra,
- delayMs i stopOnError sa czytane przez realny MacroRunner, nie preload mock.

## 4.7 Namespace notifications

### notifications.macroRun

Wymagane:
1. Notyfikacja systemowa z lokalizacja jezyka.
2. Feature gate przez ustawienie notifyOnMacroRun.
3. Rate limiting (ochrona przed spamem).

## 5. Persistencja danych (backend store)

## 5.1 Co musi byc trwale

1. Ustawienia aplikacji.
2. Makra (id, metadata, status konfiguracyjny, blocksJson).
3. Logi (ostatnie N wpisow).
4. Statystyki runtime (runs success/fail, timeSaved).
5. (Opcjonalnie) historia zmian i wersja schematu.

## 5.2 Proponowana struktura store

1. settings: AppSettings.
2. macros.byId: Record<string, Macro>.
3. macros.order: string[].
4. logs.buffer: ActivityLog[].
5. stats.counters:
- totalRuns,
- successfulRuns,
- failedRuns,
- timeSavedMinutes.
6. schemaVersion: number.

## 5.3 Migracje

Wymagane:
1. Migracja starych payloadow blokow (np. value -> key/text).
2. Migracja brakujacych pol settings.
3. Migracja statusow makr (jesli enum sie zmieni).

## 6. Runtime wykonania makr

## 6.1 Parser i model komend

Wymagane:
1. Jednolity model komend wejsciowych.
2. Mapowanie z blocksJson na runtime command list.
3. Walidacja runtime command (brak type, zly payload -> ERR log).

## 6.2 Executor

Wymagane:
1. Obsluga komend:
- PRESS_KEY,
- TYPE_TEXT,
- MOUSE_CLICK,
- WAIT,
- REPEAT,
- INFINITE_LOOP (z bezpiecznikami).
2. Delay policy:
- WAIT uzywa własnego ms,
- inne komendy korzystaja z delayMs.
3. Error policy:
- stopOnError=true przerywa,
- stopOnError=false kontynuuje i loguje ERR.
4. Cancellation token:
- wymagane do globalMaster OFF i recznego stopu.
5. Wspolbieznosc:
- zabezpieczenie przed odpaleniem tej samej instancji wiele razy naraz.

## 6.3 Integracja z shortcut manager

Wymagane:
1. globalShortcut trigger -> run by macro id.
2. unregister stale shortcut.
3. cleanup przy app quit.

## 7. Obserwowalnosc i diagnostyka

Wymagane:
1. Strukturalne logi backendowe:
- channel,
- macroId,
- action,
- result,
- error details.
2. Correlation id dla run request.
3. Minimalny audit trail:
- kto/co zmienilo settings,
- kiedy odpalono makro,
- dlaczego run zostal zablokowany.
4. Opcjonalnie integracja z electron-log.

## 8. Bezpieczenstwo i granice zaufania

Wymagane:
1. Walidacja kazdego inputu IPC po stronie Main (zod).
2. Brak wykonywania arbitralnego kodu z renderer.
3. Sanitizacja danych logowanych (bez wycieku wrazliwych danych).
4. Ograniczenie uprawnien preload i contextIsolation utrzymane.

## 9. Wymagane testy backendu

## 9.1 Unit

1. MacroRepository CRUD.
2. ShortcutManager register/unregister.
3. MacroRunner delay + stopOnError + globalMaster cancel.
4. StatsService aggregate correctness.
5. SettingsService side effects (launch/theme).

## 9.2 Integracyjne IPC

1. invoke macros.* -> realny zapis i odczyt.
2. push logs/system events trafia do renderer subscribers.
3. settings.update wywoluje side effects i nie psuje danych.

## 9.3 E2E smoke

1. create macro -> save -> toggle ON -> run -> log appears.
2. globalMaster OFF blokuje run i shortcut trigger.
3. restart app zachowuje macros/settings/stats.

## 10. Kolejnosc wdrozenia (kolejka prac)

## Faza A - Fundament

1. Zbudowac MacroRepository + LogsService + StatsService.
2. Zastapic no-op [src/main/store/index.ts](src/main/store/index.ts).

## Faza B - IPC makra i logi

1. Dodac brakujace handlers macros.*, stats.get, logs.getRecent.
2. Dodac push channels logs.new-log i system.*.

## Faza C - Runtime

1. Zaimplementowac MacroRunner.
2. Podpiac ShortcutManager + globalShortcut.
3. Spiac runtime ze settings i notyfikacjami.

## Faza D - Usuniecie mock bridge

1. Odcienic [src/preload/index.ts](src/preload/index.ts) do adaptera IPC.
2. Usunac in-memory state i timery domenowe z preload.

## Faza E - Jakosc

1. Unit + integration tests.
2. Telemetria i diagnostyka.
3. Hardening edge cases.

## 11. Definition of Done backend

Backend uznajemy za zbudowany, gdy:

1. Wszystkie metody z KeybrixApi sa realizowane przez Main (nie mock preload).
2. Wszystkie dane produkcyjne sa trwale i migrowalne.
3. Makra uruchamiaja sie realnie z shortcut i recznie.
4. Logi i statusy systemowe sa pushowane z Main.
5. Ustawienia runtime (globalMaster, delayMs, stopOnError, themeMode, notifyOnMacroRun) maja realny efekt.
6. Testy przechodza i pokrywaja krytyczne scenariusze awarii.
7. Preload zawiera tylko bezpieczny bridge, bez logiki domenowej.

## 12. Lista brakow krytycznych do domkniecia natychmiast

1. Brak realnej implementacji macros IPC po stronie Main.
2. Brak realnej implementacji logs i stats IPC po stronie Main.
3. Brak realnego MacroRunner.
4. Brak realnego ShortcutManager.
5. Domena runtime siedzi w preload (do wyciecia).

To jest glowny backend scope projektu.
