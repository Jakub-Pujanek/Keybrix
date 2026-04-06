# Plan Wdrożenia Ustawień (Settings Screen)

## 1. Launch at Windows startup (Uruchamianie wraz ze startem systemu)
- **Implementacja:** Użycie natywnego API Electrona: `app.setLoginItemSettings({ openAtLogin: true/false })` w głównej warstwie (Main Process). Należy wysyłać zdarzenia IPC (Inter-Process Communication) z aplikacji React (Renderer) do Main Process, by aktualizować ten stan.
- **Trudności wdrożeniowe i ryzyka:**
  - Uprawnienia systemu operacyjnego (np. Windows może blokować aplikacje bez podpisu cyfrowego lub dodawane do autostartu przez polityki grupy).
  - Multi-platformowość (na macOS struktura jest inna, trzeba ukrywać aplikację po starcie – flaga `openAsHidden: true`).
- **Paczki npm:** Narzędzie natywne (nie potrzeba paczek), ew. `electron-store` do trzymania stanu wyboru użytkownika między uruchomieniami.

## 2. Minimize to tray on close (Minimalizuj do zasobnika systemowego przy zamknięciu)
- **Implementacja:** Kiedy użytkownik zamyka okno (`mainWindow.on('close')`), musimy przechwycić zdarzenie (`e.preventDefault()`), schować okno (`mainWindow.hide()`) i upewnić się, że ikona Tray jest widoczna. 
- **Trudności wdrożeniowe i ryzyka:**
  - Trzeba zbudować menu kontekstowe (Context Menu) dla ikony w Tray'u, w którym znajdzie się opcja "Zakończ program" (Quit). Bez niej użytkownik nie będzie mógł zamknąć aplikacji, chyba że przez Menedżer Zadań.
  - Odtwarzanie okna do właściwego rozmiaru po kliknięciu w ikonę Tray na różnych środowiskach (różnice między Windows, macOS i Linuxem w eventach `click` vs `double-click`).
- **Paczki npm:** Narzędzia natywne Electrona: klazy `Tray` i `Menu`.

## 3. Show notifications on macro run (Wyświetlanie powiadomień po uruchomieniu makra)
- **Implementacja:** Wysyłanie systemowych powiadomień z informacją o statusie uruchomionego makra używając `Notification` API Electrona w procesie Main.
- **Trudności wdrożeniowe i ryzyka:**
  - Tryb "Skupienie" (Focus Assist) na Windows 10/11 może po cichu ucinać powiadomienia.
  - Spamy powiadomień w przypadku uruchamiania makra co sekundę – system powiadomień ulegnie "zakrztuszeniu" lub zablokuje naszą aplikację. **Rozwiązanie:** należy użyć zbijania powiadomień (debounce) lub wyświetlać powiadomienia tylko przy błędach.
- **Paczki npm:** `node-notifier` jako bezpieczny fallback, jednak preferowane natywne API `Notification` Electrona.

## 4. Language Selection (POLSKI / ENGLISH)
- **Implementacja:** Wdrożenie i18n na warstwie Frontend (React). Stworzenie systematyki kluczy tekstowych `.json`.
- **Trudności wdrożeniowe i ryzyka:**
  - Konieczność propagowania wybranego języka do Main Process dla tekstów np. w menu systemowym (Tray) i powiadomieniach.
  - Tworzenie nowej architektury tłumaczeń bywa pracochłonne – trzeba zrefaktorować każdy twardy ciąg znaków (hardcoded text) i przekazać go przez translator.
- **Paczki npm:** `i18next`, `react-i18next`.

## 5. Global Master Switch (Zakaz uruchamiania jakichkolwiek makr)
- **Implementacja:** Flaga nadrzędna (`boolean`), która jest sprawdzana przed tym, zanim silnik (`macro-runner`) zinterpretuje i uruchomi instrukcję makra.
- **Trudności wdrożeniowe i ryzyka:**
  - Moment "wyłączenia": jeśli użytkownik odznaczy checkbox w trakcie *działającego* makra, aplikacja musi posiadać architekturę bezpiecznego przerywania działania w tle, a nie tylko blokadę uruchamiania kolejnych.
- **Paczki npm:** `zustand` (jeśli jeszcze nie używany) do trzymania globalnego stanu w React + `electron-store` do konfiguracji w Main. 

## 6. Default delay between actions (Domyślny czas odstępu pomiędzy akcjami)
- **Implementacja:** Dodanie parametru konfiguracyjnego `delayMs`, w przypadku gdy silnik makr nie ma zdefiniowanego jawnego czasu między akcjami.
- **Trudności wdrożeniowe i ryzyka:**
  - Podanie ujemnych lub bardzo wysokich wartości zablokuje kolejkę całkowicie. Pola muszą mieć silną walidację w UI (`min: 0`, `max: np. 10000`).
  - Ostrożność przy pauzach silnika: konieczne zaimplementowanie nieblokującego wątku oczekiwania - `await sleep(delayMs)`.
- **Paczki npm:** Walidacja wejść przez np. `zod` opcjonalnie.

## 7. Stop execution on error (Zatrzymaj wykonanie po napotkaniu błędu)
- **Implementacja:** Owinięcie każdego wywołania akcji makra w bloki `try-catch`. Gdy ustawienie ma wartość `true`, rzucony błąd przerywa cały proces wykonawczy.
- **Trudności wdrożeniowe i ryzyka:**
  - Zostawienie po sobie "niedokończonych spraw" (np. makro wcisnęło klawisz "Shift", pojawił się błąd, makro zgasło, klawisz systemowy "Shift" pozostał wciśnięty). Konieczne procedury czyszczenia (cleanup routines), resetujące peryferia do stanu naturalnego.
- **Paczki npm:** Brak – praca na czystej logice biznesowej w silniku `src/main/macro-runner/`.

## 8. Environment Theme (DARK / LIGHT)
- **Implementacja:** Przełącznik operujący na klasach `.dark` / `.light` w roocie aplikacji we webview. Wgranie informacji o theme do Electrona.
- **Trudności wdrożeniowe i ryzyka:**
  - Rozdźwięk UI: Pasek systemowy Electrona może pozostać jasny na Windows. Konieczna aktualizacja przez `nativeTheme.themeSource = 'dark' | 'light'` po stronie Main Process.
  - Flash of unstyled content (FOUC): błysk białego ekranu przy starcie (należy zserializować domyślne ustawienie PRZED pokazaniem okna).
- **Paczki npm:** Można oprzeć się na obecnym `tailwindcss` modyfikując `darkMode: 'class'`.

## 9. Accent Palette (Wybór koloru akcentu)
- **Implementacja:** Ustawienie zmiennych CSS (CSS Variables) dla akcentu interfejsu zamiast wstrzykiwania sztywnych klas hex, np. tworzenie globalnej zmiennej `var(--color-accent)`.
- **Trudności wdrożeniowe i ryzyka:**
  - Konieczny duży proces refaktoryzacji frontendu – kod obecnie używa bezpośrednich wartości (np. `text-[#2f79ff]`, `bg-[#ff821f]`). Trzeba zaktualizować `tailwind.config.js` opierając definicję koloru o zmienne CSS i przepisać setki miejsc.
- **Paczki npm:** `clsx` oraz `tailwind-merge` do wygodnej manipulacji klasami w komponentach.

## 10. Check for system updates ↺ (Aktualizacje systemu)
- **Implementacja:** Zintegrowanie paczki do auto-aktualizacji wywoływanej po kliknięciu. Pakiet pobiera różnicowe paczki (np. z GitHub Releases) i aplikuje na re-starcie.
- **Trudności wdrożeniowe i ryzyka:**
  - Aktualizacje zazwyczaj polegają na posiadaniu "Code Signing Certificate", bez których program u użytkownika zapali na czerwono tarczę antywirusa (np. SmartScreen Warning). Pociąga to za sobą roczne koszty oraz komplikacje produkcyjne przy tworzeniu pipeline CI/CD na platformie macOS i Windows.
- **Paczki npm:** `electron-updater`.
