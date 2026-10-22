# Raindrops V1.9.9 - YouTube search 20 s timeout (see V1_9_9.md; on top of V1.9.8)

# Raindrops V1.9.8 - YouTube search one request at a time (see V1_9_8.md; on top of V1.9.7)

**V1.9.8:** the YouTube tab now sends its searches one after another like V1.6.0 did, instead of six at once. Fix + diagnose also tests the music search V1.6.0 used. Nothing was run on a phone, see V1_9_8.md.

# Raindrops V1.9.7 - build hardening, crash guards, in-app diagnostics (see V1_9_7.md; on top of V1.9.6)

**V1.9.7:** hardened GitLab CI (see GITLAB.md), icon verified inside the build, service crash path fixed, WebView-loss guard, Record tab > Fix + diagnose. Nothing in this release was compiled or run on a phone, see V1_9_7.md.

# Raindrops V1.9.6 - YouTube plugin, GitLab build, icon wired, crash report (see V1_9_6.md; on top of V1.9.5)

**V1.9.6:** GitLab CI builds the APK (see GITLAB.md). The NewPipe YouTube plugin is now in native/. The raindrop icon is installed by the build. A crash report is copied on the next launch. Details in V1_9_6.md.


## What was broken (found by reading and testing the code)
- **CONFIRMED BUG, Free full songs (Jamendo / Internet Archive) showed nothing.** In stream.js the last line replaced `window.RDstream`, wiping `save`, `stop` and `play`. free.js then crashed on its first search (`R.stop is not a function`) before any request was sent. Fixed: the export is merged, and free.js guards the call. Tested: the old file is missing those 3 functions, the new one has all of them.
- **Audius** failed with one generic message. It now shows the real reason (HTTP code, no host, timeout).
- **Library import crash / app exiting** (multi-select): the import ran with no per-file protection and no pause for the UI. One bad file or low memory ended the whole run.
- **App refreshing**: nothing saved your place, so when Android reclaimed the page you started again from the top.
- NOT CONFIRMED: Deezer and Audius. Both look right in code. They may be down or blocked on your network. In the app, open the Record tab and tap Fix + diagnose, Check (V1.9.7). It shows which service answers and the exact error. tools/provider-check.sh is the old Termux version and is optional.

## What changed
- stream.js, free.js: provider fixes above.
- app.js: import is one file at a time, each file in its own try/catch, UI yields between files, progress every 10, one import at a time, quota full stops cleanly, summary shows saved / already there / failed with the reason.
- app.js: library read falls back to a cursor if the normal read fails, and the error text is shown.
- app.js: global error guard (script errors are logged, failed promises toast once every 4 s instead of killing a feature).
- app.js: **always-live**. The foreground service now starts when the app opens and stays on (text: "Running in background"), recording and playback still switch its mode. It is re-asserted every time the app returns to the screen.
- app.js: **never starts over**. Last tab, song and position are saved every 4 s and on leaving, and restored on launch (no autoplay).
- KeepAliveService.java: notification text for idle, wake lock now 12 h and renews itself if it lapsed.
- NEW www/lyricsx.js: lyrics from LRCLIB exact match (artist + title + length), structured search, loose search, title-only search, cleaned title (removes feat / Official / Remastered tags), then lyrics.ovh as a plain-text fallback. Runs in parallel, de-duplicates, ranks (title match, length within 4 s, synced over text), cached for 7 days (16 songs). Used by Rap-Along and the Find tab auto lyrics.
- rapalong.js: **search bar** in Rap-Along (type "song", "artist song" or "artist - song"), prefilled with the current song. Results list shows length, synced or text only, and the source. S.O.I. x Bojack Security 999 mark under the controls.
- NEW tools/provider-check.sh: pings every service the app uses, prints OK or FAIL with HTTP code and time.
- prep-android.sh: now copies every `native/*.java`, so your YouTube plugin travels with the zip if you drop it in `native/`.

## YouTube
Untouched. It keeps using your NewPipe plugin (ytSearch / ytGet).

## MISSING FROM THIS ZIP (not recreated, I have never seen these files)
- The NewPipe YouTube plugin source (Raindrops plugin Java).
- `.gitlab-ci.yml` and the `android/` project.
Extract this zip OVER your repo, do not replace the repo folder, so those stay. Put your plugin Java file in `native/` and prep-android.sh will install it.

## Test status
- PASS: node --check on every www/*.js, bash -n on both scripts.
- PASS: lyricsx.js, 12 of 12 checks (exact match, dedupe, cache, ovh fallback, offline error, structured search, ranking, partial failure).
- PASS: stream.js export now contains save, stop, play, saveBlob, ytAdd, stopPv, NAT, RDp; free.js loads.
- NOT TESTED: nothing ran on a phone or in a browser. Java not compiled. Import crash cause is unconfirmed without a device log; this version removes the weak points I found. Honor / MagicOS also kills background apps hard: set Raindrops battery to Unrestricted and lock it in recents.
- tests/ui-test.js and the other browser tests were not re-run (no Chromium here).

## Still to do (running list)
- If providers still show nothing after provider-check, send me the output.
- Paste-your-own-lyrics box for unreleased tracks no service has.
- Per-line timing for text-only lyrics.
- Deezer shows 30 s previews only, full songs come from the YouTube match.


# Raindrops V1.9.4 - Runtime permissions + full manifest (on top of V1.9.3)

## V1.9.4 - what is new
- NEW android-res/AndroidManifest.xml: complete Capacitor manifest with RECORD_AUDIO, MODIFY_AUDIO_SETTINGS, WAKE_LOCK, FOREGROUND_SERVICE (+ media playback + microphone types), POST_NOTIFICATIONS, REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, mic uses-feature (not required) and the KeepAliveService. Push-only: copy it over android/app/src/main/AndroidManifest.xml in your repo. If your manifest has extra entries of your own, merge the uses-permission lines and the <service> instead of overwriting.
- NEW runtime permission bridge (www/native.js + native/RaindropsSysPlugin.java): mic is a real Capacitor permission alias ("mic"), notifications go through LocalNotifications. window.rdEnsureMic(), window.rdEnsurePerms(), window.rdOpenSettings().
- CHANGED www/app.js: startRec() asks for the mic BEFORE getUserMedia and before the Web Audio graph is touched. If it is blocked it toasts and opens App settings.
- WAKE_LOCK and FOREGROUND_SERVICE are install-time permissions (manifest only). Android has no runtime prompt for them. Only RECORD_AUDIO and POST_NOTIFICATIONS (Android 13+) prompt.
- NOT TESTED: Java not compiled, nothing run on a phone.

# Raindrops V1.9.0 - Mix Rack (on top of V1.8.0)

## V1.9.0 - what is new
- IMPLEMENTED: **Mix Rack tab** (next to Mixer, www/rack.js). Live scope (voice bars up, beat bars down, peak dots), live "Voice sits +N dB over the beat" readout, play/stop, hold-to-bypass A/B button, Surprise (safe random), Reset.
- IMPLEMENTED: **Voice rack**, after the Mixer chain: Rumble cut, Mud cut, Presence, Air, Warmth, Leveler (max 4:1), Glow (blended saturation), Slap echo, Plate space (filtered so it does not mud), Pre-delay, Voice trim, safety limiter at -1.5 dB. Applies to playback and export. Optional on ad-libs.
- IMPLEMENTED: **Beat rack**, after Beat master: Sub clean, Mud cut, Harsh tamer, Open up, Glue (max 2.8:1), Warmth, Beat trim, safety limiter. Beat is routed through Web Audio when Beat master is on OR a beat rack control is above 0 (switches in by itself if you raise one mid-take).
- IMPLEMENTED: **Balance** card: Balance slider (voice up to +3 dB / beat down to -6 dB, or the reverse, smaller), plus Duck and Voice pocket (same controls as Beat master), plus **Auto-balance from my take** (runs Adapt to song + Match to my voice).
- IMPLEMENTED: **7 rack presets** (voice + beat + balance together): Flat, Clean Lead, Airy Pop, Trap Space, Warm Mid, Tight + Dry, Voice Lead.
- IMPLEMENTED: **AI rack doctor** (Gemini, same key as Studio AI): pick a vibe, say what you hear, optionally let it see your measured voice bands. It returns rack settings that are clamped to tighter safe ranges than the sliders. Studio AI chat now knows the Mix Rack tab.
- The Mixer "Effects ON" switch also turns the voice rack off, so Off is still the raw take.
- CHANGED: www/beatfx.js (Beat master core + rack beat chain composed into one; routing check; refresh; exports analyser/put), www/app.js (rack hooks in playR, stopPlay, renderMix: voice, ad-libs, export gating and tail), www/index.html (tab, panel, script tag), www/style.css (appended), www/ai-core.js (chat prompt). NEW: www/rack.js.
- RESTORED: package.json, package-lock.json, capacitor.config.json (appId com.fezzy.raindrops, webDir www), .gitignore, prep-android.sh (npm install, cap add android if missing, copy icons, add manifest permissions, cap sync). Capacitor packages pinned to the 8.x line (core/cli/android 8.5.3, filesystem 8.1.5, share 8.0.3, local-notifications 8.3.1). If your existing android/ project was made with another major version, change the versions in package.json to match it before you run prep-android.sh.
- NOT IN THIS ZIP, NOT RECREATED: the native Android plugin "Raindrops" (YouTube search + download, background keep-alive, battery, app settings). Its Java source was never in the zip. Copy your own files into android/app/src/main/java and register them or those features stay "Android app build only".
- NOT TESTED: nothing in V1.9.0 was run. node --check passes on every www/*.js file and bash -n passes on prep-android.sh. The slider-to-dB maps, the beat re-routing mid-take, the scope and the AI JSON handling are written but unheard. Existing test files in tests/ were not re-run and tests/ui-test.js may need the new tab added to its tab list.

# Raindrops V1.8.0 - Rap-Along Mode (on top of V1.7.0)

## V1.8.0 - what is new
- IMPLEMENTED: **Free full songs** card in Library (www/free.js). Jamendo (needs a free client id, paste once) and Internet Archive (no key). Whole tracks, not previews: ▶ streams, ＋ saves to Library. "Beats only" chip. Jamendo tracks with downloads switched off show as stream only. NOT TESTED (no network here). Jamendo field names come from its v3.0 docs; Internet Archive search + metadata API written from memory. stream.js now exposes window.RDstream (save, stop, play).
- IMPLEMENTED: **Beat master** (Effects tab, top card, www/beatfx.js). Shapes the SONG so the artist sits beside you like a duet and your voice stays centre. Presets: Flat, Duet Blend, Darker, Lighter, Way Back, Voice Up Front. Sliders: Dark-Light, Back, Voice pocket, Width, Duck under my voice, Low end, Beat level. "Match to my voice" measures your latest take against its song and sets the sliders. Applies in take playback and export, not while recording (so timing does not move). Hooks: 3 one-line edits in app.js (playR, stopPlay, renderMix).
- IMPLEMENTED: YouTube search now runs 3 phrasings x Songs/Videos at once, merges and de-duplicates, shows 20 with Show more.
- NOT TESTED: Beat master and the YouTube change. Syntax-checked only. The match numbers are rule-of-thumb heuristics.
- IMPLEMENTED: **Rap-Along mode** (Record tab, top card): full-screen lyrics, big glowing current line, dimmed next line, tap any line to jump the song there, then record from that verse (uses the V1.4.0 start-from-playhead). New file www/rapalong.js, small additions to index.html and style.css.
- The sweep across the line is an ESTIMATE: LRCLIB times whole lines only, so the sweep is spread evenly over the likely length of the line.
- Wrong-lyrics guard: shows the LRCLIB match in use (title, artist, synced or text only, length difference vs your track, warns past 4 s). Swap cycles to the next best match; tap the match box for the full list.
- NOT TESTED on a phone or in a browser. Written against the existing lyrics code (L, timed, applyLy, jget, startRec). Tap-jump and record-from-verse rely on that code unchanged.

- IMPLEMENTED: YouTube search has a Both / Songs / Videos toggle. Both searches run at once, results are merged and de-duplicated, and one failing kind no longer hides the other. NOT TESTED: needs the native plugin. Load more (paging) is NOT done because the native plugin source is not in this zip.

## V1.7.0 Part 1: Deezer

Drop-in replacement for the `www/` web layer. Nothing native was touched.

## V1.7.0 Part 1 - what is new
- IMPLEMENTED: **Deezer card** in Library > Stream (above Audius). Search box, **Rap chart** and **Top chart** chips, cover art, artist, album, length.
- IMPLEMENTED: **30 s preview** (play/stop). Rows with no preview have the button greyed.
- IMPLEMENTED: **Add (full song)**. Deezer only gives 30 s previews, so on the Android app Add searches YouTube for "artist title", picks the closest length and skips Live / slowed / remix / karaoke versions when it can, downloads it, and saves it with **Deezer's title, artist and cover art**. If the best match is 15+ s different in length you get a warning.
- IMPLEMENTED: Browser build (no Android app): Add saves only the 30 s preview, labelled "(30s preview)".
- IMPLEMENTED: Deezer requests try normal fetch first, then Capacitor's native HTTP if the browser blocks it. 10 s timeout, clear error text, nothing crashes if Deezer is down.
- CHANGED: www/stream.js (3 small edits: ytAdd accepts optional title/artist/art override, helpers exposed as `window.RDstream`). www/index.html (card + 1 script tag), www/style.css (appended). NEW: www/deezer.js, tests/deezer-test.js.

## Test status Part 1
- TESTED (headless Chromium, mocked Deezer + mocked native plugin): tests/deezer-test.js 30 of 30 pass. Covers search, junk rows dropped, HTML escaping, chips, previews, browser add, API error, network down, version picking, CORS-blocked fallback to native HTTP, YouTube query, studio cut chosen over Live, Deezer metadata and cover saved.
- RE-RUN, still passing: ui-test 26/26, transport-test 31/31, test-core 23/23.
- NOT TESTED: real Deezer (no internet here). Whether api.deezer.com is reachable from your phone's webview, or needs the native HTTP fallback, is unconfirmed. The genre id 116 for the Rap chart is from my memory of Deezer's API. The real NewPipe ytSearch/ytGet were mocked. The version picker is a rule of thumb and can still pick wrong.

## Still to do (running list)
- Part 2: YouTube Songs/Videos toggle, search both and merge/de-dupe.
- Part 3: Rap-Along Mode (full-screen lyrics, tap-to-seek, A-B loop, wrong-lyrics swap).
- Load more on YouTube needs the native plugin file (not in the zip).

# Raindrops V1.6.0 - Auto latency pairing, vocal presets + Off + Adapt to song, 3 new reverb rooms (on top of V1.5.0)

Drop-in replacement for the `www/` web layer (appId com.fezzy.raindrops, webDir `www`). Nothing native was touched.

## V1.6.0 - what is new
- IMPLEMENTED: **Latency pairing** (Record tab card + Mixer take row). Recording through headphones makes your voice land LATE against the song (headphone delay + mic delay). The app now works out that delay, saves it WITH each take when you press record (`take.lat`), and delays the song by that amount on playback and export. A take recorded on Bluetooth stays right even if you play it later on a speaker.
  - Sources, best first: **Tap calibration** (tap along to 12 clicks, about 11 s, saved per output device) > what the phone reports (outputLatency + baseLatency) > a guess (Bluetooth 180 ms, other 45 ms). Mic latency = the mic track's own setting if the phone gives one, else 20 ms guess. Shown on the card with the source.
  - Headphones plugged, unplugged or Bluetooth connected: the app re-measures and tells you ("Audio device changed: 190 ms").
  - Mixer: "Take latency: N ms" with **Re-pair to now** (sets the selected take to the current pairing; use it if you changed headphones after recording).
  - **Auto latency pairing** switch (on by default). Off = only the Voice sync slider is used.
  - CHANGED: Voice sync is now a manual TRIM on top of auto (range -300 to +600). One-time move: your old Voice sync value is kept for old takes (they have no saved latency) and the slider was reset to 0 so it is not counted twice.
  - NOT covered: ad-lib (track 2) timing is untouched, use "Ad-lib timing fix". Bluetooth mic (headset call mode) is not modelled.
- IMPLEMENTED: **4 new vocal presets**: Polished, Clear, Rumble + spit clean, Hard limit. Plus the existing six.
- IMPLEMENTED: **Off** chip beside the presets: bypasses every effect (output is bit-identical to the raw take, tested). Your settings are kept; tapping any preset turns effects back on. Preset name now shows on the card and clears if you move a preset-owned slider (EQ, Voice focus, gains do not clear it).
- IMPLEMENTED: **Adapt to song**. Switch "Adapt preset to the song" (on by default) + button "Adapt to song now". It measures your voice against the take's backing song with the V1.5.0 analyzer, then sets the 4 Voice EQ bands (boost only, 0 to +8 dB) and Voice focus (0 if Mid is fine, else 20 + 8 x the Mid shortfall, max 120%). Needs a take with a backing song and a few seconds (first 90 s analysed). It REPLACES your EQ and focus values when it runs. The numbers are my rule of thumb, not measured on your voice.
- IMPLEMENTED: **3 new reverb rooms**, each its own mix slider, all included in export:
  - **Plate** - short (about 1.7 s), dense, bright.
  - **Cathedral** - long (4.6 s), dark, huge. Heaviest on CPU.
  - **Halo** - soft bloom that swells in over about 0.25 s, 60 ms pre-delay, airy top. This is a bloom, NOT a true octave-up shimmer.
  - Levels matched to the old Reverb mix (tested within 6 dB).
- IMPLEMENTED: **App icon** = orange raindrop (#FF6B00 gradient, small highlight) on pure black. www/icon-192.png + icon-512.png replaced (web / favicon). The native Android launcher icons are NOT in this zip, so the installed app icon only changes after you copy the new files: `android-res/res/*` into `android/app/src/main/res/` (mipmap-mdpi..xxxhdpi `ic_launcher`, `ic_launcher_round`, `ic_launcher_foreground`, adaptive XML + black background colour), then `npx cap sync android` and rebuild. Alternative: `npx @capacitor/assets generate` using `android-res/icon-source-1024.png` and `icon-foreground-1024.png`. NOT checked on a real launcher (round/adaptive masks may crop differently by phone).
- NEW: `GEMINI_PROMPT.md` - master prompt for Gemini (plan first, tags, pushback, no skeletons, your build rules).

- CHANGED: www/mixer.js (reverb rooms, 4 presets, Off, Adapt, preset state), www/app.js (4 small edits: take saves `lat`, playback + export use it), www/transport.js (1 edit: seek uses it), www/index.html (slider range, 1 script tag). NEW: www/latency.js, tests/v160-test.js.

## Test status V1.6.0
- TESTED (headless Chromium, real audio math): tests/v160-test.js 55 of 55 pass. Covers: Off bit-exact; presets never clip and are never silent; Rumble preset cuts 40 Hz by 12+ dB; Plate/Cathedral/Halo decay length, brightness, bloom and level; Adapt boosts Mid and sets Voice focus on a quiet-voice/loud-mid-song test and does nothing without a song; tap math (180 ms found within 12 ms, bad taps rejected); a real record saves `lat`; export delays the song by exactly 0 / 200 / 420 ms; the tap calibration screen end to end with simulated taps; calibration survives reload.
- RE-RUN, still passing: ears-test 58/58, ui-test 26/26, transport-test 31/31, test-core 23/23. export-test not re-run (video export code untouched).
- NOT TESTED: anything on a real phone or Bluetooth headset. Whether the Honor X5b / your headphones report their latency honestly, how close tap calibration lands on your hands (expect roughly +-30 ms), Cathedral CPU load on the X5b while playing with other effects, and how the Adapt numbers sound on your real voice. If the auto value is off by a little, use Calibrate, then the Voice sync trim.
- Tap calibration measures the delay from the audio engine to your ear plus your tap reaction. Tap reaction is not subtracted (touch delay and anticipation roughly cancel, not measured).

## Earlier versions

# Raindrops V1.5.0 - Voice analyzer, Voice focus (second voice), Voice EQ, Gemini ears (on top of V1.4.0)

Drop-in replacement for the `www/` web layer, same as before (appId com.fezzy.raindrops, webDir `www`). Nothing native was touched.

## V1.5.0 - what is new
- IMPLEMENTED: **Voice analyzer** card in the Mixer. Live bars for Bass (60-250 Hz), Low-mid (250-800 Hz), Mid (0.8-3 kHz), High (3-10 kHz) while a take plays. Voice only, after your effects, so you see the EQ working. The song is NOT in the live bars (it plays outside Web Audio on purpose, to keep it clean).
- IMPLEMENTED: **Analyze this take (voice vs song)**. Decodes the take and its backing song offline, measures each band only while you are talking (quiet gaps are skipped), lines the song up from where the take started, and shows voice level, song level, gap, and a hint per band: "Boost about +N dB" / "Balanced" / "Strong here". Hints are a rough rule of thumb (target gap per band: Bass -10 dB, Low-mid -3, Mid +2, High 0; a boost shows when you are 2+ dB short of it, capped at 8). They are my starting numbers, not measured on your voice. Trust your ears. First 90 s of the take.
- IMPLEMENTED: **Apply suggested boost** sets the Voice EQ sliders for you.
- IMPLEMENTED: **Voice EQ** (Mixer): Bass, Low-mid, Mid, High, each -12 to +12 dB, live while playing, included in export. Presets no longer wipe your EQ. Reset EQ button.
- IMPLEMENTED: **Voice focus (second voice)** slider (0-200%): a second copy of only your voice range (220 Hz up to 7.5 kHz, compressed so it stays steady) added on top of your voice. Raise it when the song swallows your words. Only your voice is lifted, the song is untouched. At 100% it adds about 6 dB in the voice range and about 1 dB at 60 Hz (measured with test tones). Plays and exports.
- IMPLEMENTED: **Gemini ears** card in Studio AI (collapsible). You choose, with switches, what Gemini can see:
  - library list (titles + artists, first 150) - ON by default
  - recordings list (name, length, main/ad-lib, backing song, start point, first 40) - ON by default
  - the measured Bass / Low-mid / Mid / High numbers for the chosen take - ON by default
  - an audio clip of the chosen take, 30 s up to 5 min (slider; your voice with your current effects, optionally with the backing song; mono 16 kHz WAV, about 1 MB per 30 s, so up to about 10 MB at 5 min) - **OFF by default**. Turning it on asks you to confirm. It is sent to Google every time you tap Ask.
  - The 30 s first cap was my choice, not a Gemini limit. Longer clips mean a bigger upload and a longer wait. A 5 min request is NOT tested on the phone or against live Gemini (timeout raised to 3 min for clips).
  Pick a take, pick where the clip starts, type what to listen for (or leave it blank), tap Ask Gemini to listen. The answer uses the app's own control names (Voice EQ Bass/Low-mid/Mid/High, Voice focus layer, Compression...). Save to Notes works. If no audio is attached, Gemini is told so and told not to claim it heard anything.
- CHANGED: www/mixer.js (34 lines: DEF, chain wiring, 5 sliders, 2 cards, reset button, `put` exposed on `window.MX`), www/index.html (one script tag, one sentence in the privacy hint), www/style.css (appended block). NEW: www/ears.js, tests/ears-test.js. Nothing else touched.

## Privacy change (read this)
V1.3.0 and V1.4.0 never sent audio anywhere. V1.5.0 can, but only if you switch on "Let Gemini hear a 30 s audio clip". With that switch off, only text and numbers go to Google, and only when you tap Ask. Your key still lives only in the phone's local storage and travels in the x-goog-api-key header.

## Test status V1.5.0
- TESTED (headless Chromium, phone size, mocked Gemini, real audio math): tests/ears-test.js 55 of 55 pass. Covers: EQ moves a 100 Hz / 500 Hz / 2 kHz / 8 kHz tone the right way by the right amount, Voice focus lifts the voice range and leaves 60 Hz nearly alone, analyzer finds a bass-heavy song under a mid-heavy voice, no-song takes get levels only, live bars run while a take plays and reset after, presets keep your EQ, request carries the key in the header only, each Gemini switch really removes its data from the request, no audio part is sent while the switch is off, the audio part is a real mono 16 kHz WAV of the right length with sound in it, declining the confirm keeps audio off.
- RE-RUN, still passing: tests/ui-test.js 26/26, tests/transport-test.js 31/31, tests/test-core.js 23/23. tests/export-test.js was not re-run (video export code was not touched).
- NOT TESTED: a real Gemini call with a live key (Gemini was mocked, so I have NOT confirmed how well it judges audio), the native CapacitorHttp path with a ~1.3 MB audio request in the Android app, the live bars and analysis on the Honor X5b, and the analyzer on real vocals (tested with synthetic tones only). The boost hints have never been compared against your ears.
- Not built: Gemini does not "watch" the Library on its own. It only sees what you share when you tap Ask. The Prodigy code was not available to me, so this follows the Gemini client already in Raindrops.

## Earlier versions

Drop-in replacement for the `www/` web layer of Raindrops (appId com.fezzy.raindrops, webDir `www`).
Recovered from raindrops-debug-V1.2.1.apk (assets/public), then extended. Nothing in the native Android side was touched.

## V1.4.0 - Now playing bar, back / forward, record from a verse
- IMPLEMENTED: a Now playing bar on the Record screen (under the big buttons), in the Mixer (under play/stop) and at the top of Library (sticks while you scroll, so you can use it while previewing Audius tracks before you tap +). Shows title, artist/take, time, seek bar, back to start, back 10s, play/pause, forward 10s.
- Tap skips 10s. Hold a skip button to scrub, it speeds up the longer you hold. You hear it while it plays.
- Works on whatever is playing: a take (voice, ad-libs and backing track stay in sync), the backing song, or an Audius preview. The lyrics drawer got the same back / forward buttons. Lock-screen skip buttons are wired too.
- Rap a selected verse: seek the backing song to the verse, then hit Record. The take starts the backing track from that spot (Record screen says where, e.g. "Next take starts the backing track at 1:12"). The start point is saved with the take, so playback, mixer and export line up. Takes in My recordings show it as "@1:12". Hit the back-to-start button to record from the top again.
- LOCKED while recording: skip buttons and seek bar are greyed out. Moving the backing track mid-take would break the sync that is saved with the take.
- FIXED: video export was slow. Cause: when the phone's WebView cannot encode AAC audio, the old fast path threw straight away and the app silently fell back to real-time rendering, which takes as long as the song. Now the AAC encoder is built in (WASM, www/lib/), audio and video encode at the same time, and the MP4 is packed by Mediabunny. Video is 480x480 at 6 fps, H.264 (VP9 if H.264 is missing). The libraries only load when you export a video, so app start is not slower.
- Phone-freeze fix: video export now does one thing at a time (audio in 4 s chunks, then the picture) at 6 fps, hands control back to the phone every few frames, and the Cancel button now stops an export in progress. Test: 300 s take in 24 s, JS heap peaked at 133 MB.
- If the fast path still fails, you now get a message with the real reason and a choice. The slow real-time render only runs if you tap OK.
- TESTED (headless Chromium, no native AAC there, so the built-in encoder ran): 300 s take exported to a 480x480 MP4 in 23 s (about 13x real time), 60 s take in 5 s. ffprobe: valid AAC 48 kHz stereo + video, decodes clean. tests/export-test.js.
- NOT TESTED: the H.264 encoder (not available in the test browser, VP9 ran instead) and speed on the Honor X5b. Expect slower than the numbers above on a phone, but not real time.
- Libraries: Mediabunny + @mediabunny/aac-encoder 1.62.0 (MPL-2.0, license in www/lib/). The AAC encoder is FFmpeg's, built to WASM.

- NEW www/transport.js. CHANGED app.js (record start point, 5 small edits), stream.js (exposes the preview audio), index.html (one script tag), style.css (appended block). Nothing else touched.
- TESTED (headless Chromium, phone size, fake mic, real MediaRecorder take): tests/transport-test.js 31 of 31 pass. Covers skip, hold-scrub, seek bar, clamping at both ends, pause/resume on song and on a take, lock while recording, take saved with start point, backing track following the take after a seek, no JS errors. tests/ui-test.js (V1.3.0 Studio AI) re-run, still passes.
- NOT TESTED: on a physical phone, in the Capacitor Android build, Audius preview seeking with a live stream, hold-scrub feel on a touchscreen.

## V1.3.0 - what was new
- IMPLEMENTED: new "Studio AI" tab with three modes.
  - Ad-libs: type a line, or use the current lyric, or a line from Notes. Pick a vibe. Get 6 ad-lib ideas with placement and delivery. Copy one, or save all to Notes.
  - Beats: describe what you are writing, pick mood and tempo. Gemini picks from YOUR Library (Use as backing / Preview) and gives search ideas that run in the Audius search.
  - Chat: short studio-partner chat, last 24 messages kept on the phone, Clear chat button.
- IMPLEMENTED: entry points outside the tab. "Ad-lib ideas from AI" on Record, "Pick a beat with AI" in Library, "Ad-libs for this line" in the lyrics drawer (runs straight away).
- IMPLEMENTED: Gemini settings (key, model, Check key, Remove key). Model is Auto by default: the app asks the API which models your key can use and picks the newest stable Flash, hides image/audio/embedding models, and re-picks once if a model returns 404.
- IMPLEMENTED: follows every theme colour (uses --accent / --accent2).

## Files
- NEW www/ai-core.js: Gemini client, model picker, JSON parser, prompts (no DOM).
- NEW www/ai.js: Studio AI UI.
- CHANGED www/index.html: additive only (tab, panel, 3 entry buttons, 2 script tags before native.js).
- CHANGED www/style.css: appended block at the end (V1.3.0 Studio AI). Nothing existing edited.
- UNCHANGED: app.js, mixer.js, stream.js, native.js, themes.js, edge.js, bobble.js, dupes.js, mp4mux.js, rd-worklets.js, icons.

## Install
1. Replace the `www/` folder of the Raindrops Capacitor project with this one.
2. Run your normal `npx cap sync android` and build (your GitLab CI or local).
3. Open Studio AI > Gemini settings, paste your key, tap Check key.

## Privacy and keys
- No key is in this zip. The key is typed in the app and kept in the phone's local storage only. It is sent as the x-goog-api-key header, never in the URL.
- Only text goes to Google when you tap a button: your line, brief, chat messages, or song titles for beat picks. Audio never leaves the phone.
- A key inside an app can be extracted from the phone by anyone with access to it. Fine for your own phone. Do not share a build with your key saved in it.

## Test status
- TESTED (node, mocked Gemini, tests/test-core.js): 23 of 23 pass. Model picking, JSON parsing, error messages, 404 re-pick, key header, JSON mode, blocked/empty/offline handling.
- TESTED (headless Chromium, phone-size screen, mocked Gemini, tests/ui-test.js): 26 of 26 pass, no JS errors. Covers no-key state, Check key, ad-libs, save to Notes, beats (bad and duplicate picks dropped), Use as backing, search handoff to Audius, chat, lyrics drawer entry, bad-key error, existing tabs still working.
- NOT TESTED: a real Gemini call with a live key, the native CapacitorHttp path inside the Android app, and anything on a physical phone. No Android SDK here, so no APK was built.
- PLANNED, not built: speaking ad-libs/beat briefs by voice, letting Gemini listen to a take.

## Version note
The APK file was named V1.2.1 but the code comments reach V1.6.0 (stream.js). This release is labelled V1.3.0 as planned. Rename if your numbering differs.
