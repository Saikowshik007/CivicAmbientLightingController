# Validation — 0.2.1 / version code 7

## Cabin revision

- Replaced the procedural blocks with the CC-BY 2022 Civic mesh by Ricy, recolored in a Rallye Red-inspired finish. Converted legacy spec/gloss materials to core PBR; geometry and embedded textures are retained. Cabin cutaway/exterior/top views have distinct dash/door lines, handle recesses, door-storage pockets, and front/rear footwell pools.
- Removed console lighting at the user’s clarification. The five location selectors only highlight geometry; existing two-group packet routing is unchanged.
- Preset format and saved zone values are unchanged from 0.2.0.

## Completed

- Clean Java 17-target compilation against official Android SDK 35, D8 conversion, AAPT2 resources/assets linking.
- Signed development APK verified with APK signature scheme v3; zip alignment passed; app bundle validated by bundletool. No signing key is in the repository.
- Both archives passed ZIP integrity/duplicate-entry checks. Every bundled UI/3D asset matched its source bytes.
- 25 Java state/boundary checks passed: known handshake/power packets, invalid ranges, preservation of the other zone, linked controls, preset JSON roundtrip, power preservation, corrupted preset handling, built-in preset validation.
- 10,515 Java-encoded packets matched the prior APK-derived Python reference: all 10,201 brightness pairs, 216 RGB boundary combinations, 36 RGB-mode pairs, and 62 flow/variation combinations.
- App and scene JavaScript syntax checks passed.
- Exact bundled UI tested in desktop Chromium at 1280×720, 1024×600, and portrait 390×844. No horizontal page overflow at tested sizes. Brightness and Apply remained visible in the final compact landscape layout. Extra settings scroll within the panel without replacing the page or stealing focus.
- Manually exercised through the UI: independent zone color; invalid/valid custom hex; brightness endpoint; power preview; six curated looks; custom preset save, reload, and selection; flow variant selection; Sync resetting to its two supported variants; controller dialog; angled cabin/top view; 3D drag and reset.
- WebGL scene rendered; browser error log was empty in the final preview. Screenshots in `docs/screenshots` are from the disconnected desktop preview, not the real head unit.
- GitHub Actions workflow included for Gradle builds and protocol/state checks. Its remote execution is separately reported when available; including the workflow does not mean it has run.

## Remaining

- No emulator or real AAOS runtime was available for running the native WebView/JavaScript bridge and native Bluetooth code together. The actual Civic WebView/GPU, permissions, AAOS lockout, and lifecycle behavior need an in-car test.
- Actual Bluetooth connection, controller initialization, notification setup, paced writes, and physical lighting response remain unverified on the installed lighting kit. Archived APK compatibility is the working hypothesis, not a hardware certification.
- Write-without-response provides no application-level confirmation. A submitted command does not prove lights changed. Device notifications are exposed as raw diagnostic bytes; they are not decoded into authoritative controller settings.
- Flow effects/variants depend on firmware; the preset preview shows desired colors/brightness, not actual effect timing. Cabin geometry is illustrative. The Civic asset is loaded from the bundled app origin, with no remote URLs or external dependencies. The two group labels follow the inspected guide and require wiring confirmation. Location highlighting is preview-only; door storage excludes the center console. No RPM/gear/drive-mode integration is present.

## Reproduce host tests (Windows example)

Requires a JDK and a standalone `org.json` JAR (the Android SDK's stub JSON classes cannot run host tests). The CI workflow downloads `org.json:json:20240303` from Maven Central.

```powershell
New-Item -ItemType Directory -Force build/protocol-tests
javac -encoding UTF-8 -cp path/to/json.jar -d build/protocol-tests app/src/main/java/dev/civic/signalcheck/AmbientProtocol.java app/src/main/java/dev/civic/signalcheck/LightingState.java tests/ProtocolTest.java
java -cp 'path/to/json.jar;build/protocol-tests' dev.civic.signalcheck.ProtocolTest build/protocol-tests/vectors.json
python tests/compare_protocol.py build/protocol-tests/vectors.json
```

Scratch directories and generated keys must stay outside committed source. See the README for Android Studio/Gradle and offline local builds.
