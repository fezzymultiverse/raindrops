#!/usr/bin/env bash
# Raindrops - prepare the Android project: add android/ if missing, copy launcher icons, add permissions,
# install the native plugins (YouTube/NewPipe + system + crash log), wire NewPipe into Gradle, cap sync.
# Safe to run again. Used by GitLab CI (no Termux needed). Run from the folder with package.json.
# V1.9.7 adds: icon verification, NewPipe version probe with fallbacks, Gradle memory, largeHeap, optional RenderGuard (only if the Capacitor source has the APIs).
set -u
cd "$(dirname "$0")" || exit 1

say() { printf '[prep] %s\n' "$*"; }
die() { printf '[prep] ERROR: %s\n' "$*" >&2; exit 1; }

[ -f package.json ] || die "package.json missing"
[ -f capacitor.config.json ] || die "capacitor.config.json missing"
[ -d www ] || die "www/ folder missing"
command -v node >/dev/null 2>&1 || die "node not found"
command -v npm >/dev/null 2>&1 || die "npm not found"

if [ ! -d node_modules/@capacitor/core ]; then
  say "installing npm packages"
  npm install || die "npm install failed"
fi
if [ ! -d android ]; then
  say "no android/ folder, creating it"
  npx cap add android || die "cap add android failed"
fi

# ---- icons (the raindrop): adaptive + legacy + round + monochrome + notification icon
RES=android/app/src/main/res
[ -d android-res/res ] || die "android-res/res missing (icons)"
mkdir -p "$RES"
cp -r android-res/res/. "$RES"/ || die "icon copy failed"
# remove default Capacitor icon variants that would shadow ours (webp + old xml in other folders)
for d in "$RES"/mipmap-*; do
  [ -d "$d" ] || continue
  rm -f "$d"/ic_launcher.webp "$d"/ic_launcher_round.webp "$d"/ic_launcher_foreground.webp
done
rm -f "$RES"/drawable-v24/ic_launcher_foreground.xml "$RES"/drawable/ic_launcher_background.xml
BG="$RES/values/ic_launcher_background.xml"
[ -f "$BG" ] || die "icon background xml missing"
say "icons installed"
# V1.9.7: prove the icon is really in the project, fail the build if not (so a build with the default icon can never ship silently)
for d in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  for n in ic_launcher ic_launcher_round ic_launcher_foreground; do
    [ -s "$RES/mipmap-$d/$n.png" ] || die "icon file missing: mipmap-$d/$n.png"
  done
done
[ -s "$RES/mipmap-anydpi-v26/ic_launcher.xml" ] || die "adaptive icon xml missing"
grep -q "ic_launcher_foreground" "$RES/mipmap-anydpi-v26/ic_launcher.xml" || die "adaptive icon xml does not use the raindrop foreground"
for d in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  cmp -s "android-res/res/mipmap-$d/ic_launcher.png" "$RES/mipmap-$d/ic_launcher.png" || die "icon in project differs from android-res (mipmap-$d)"
done
say "ICON CHECK OK: raindrop icons present in all 5 densities + adaptive + round + monochrome"

# ---- manifest
MAN=android/app/src/main/AndroidManifest.xml
[ -f "$MAN" ] || die "$MAN not found"
for p in INTERNET RECORD_AUDIO MODIFY_AUDIO_SETTINGS WAKE_LOCK FOREGROUND_SERVICE FOREGROUND_SERVICE_MEDIA_PLAYBACK FOREGROUND_SERVICE_MICROPHONE POST_NOTIFICATIONS REQUEST_IGNORE_BATTERY_OPTIMIZATIONS; do
  if ! grep -q "android.permission.$p\"" "$MAN"; then
    say "adding permission $p"
    sed -i "/<\/manifest>/ i\\    <uses-permission android:name=\"android.permission.$p\" />" "$MAN"
  fi
done
if ! grep -q "android.hardware.microphone" "$MAN"; then
  sed -i "/<\/manifest>/ i\\    <uses-feature android:name=\"android.hardware.microphone\" android:required=\"false\" />" "$MAN"
fi
# V1.9.7: make sure the manifest points at the raindrop icon and asks Android for a bigger heap
if ! grep -q 'android:icon="@mipmap/ic_launcher"' "$MAN"; then
  sed -i '0,/<application/ s#<application#<application android:icon="@mipmap/ic_launcher"#' "$MAN"
  say "manifest: android:icon added"
fi
if ! grep -q 'android:roundIcon=' "$MAN"; then
  sed -i '0,/<application/ s#<application#<application android:roundIcon="@mipmap/ic_launcher_round"#' "$MAN"
  say "manifest: android:roundIcon added"
fi
if ! grep -q 'android:largeHeap=' "$MAN"; then
  sed -i '0,/<application/ s#<application#<application android:largeHeap="true"#' "$MAN"
  say "manifest: largeHeap on"
fi
grep -q 'android:icon="@mipmap/ic_launcher"' "$MAN" || die "manifest still has no raindrop icon"
if ! grep -q "KeepAliveService" "$MAN"; then
  say "registering keep-alive service"
  sed -i "/<\/application>/ i\\        <service android:name=\".KeepAliveService\" android:exported=\"false\" android:foregroundServiceType=\"mediaPlayback|microphone\" />" "$MAN"
fi

# ---- native plugins + MainActivity (always rewritten from the stock file, it is generated code)
MA=$(find android/app/src/main/java -name MainActivity.java 2>/dev/null | head -1)
if [ -z "$MA" ]; then
  PKGDIR="android/app/src/main/java/com/fezzy/raindrops"
  mkdir -p "$PKGDIR"; MA="$PKGDIR/MainActivity.java"
fi
JAVA_DIR=$(dirname "$MA")
PKG=$(grep -m1 '^package ' "$MA" 2>/dev/null | sed 's/^package //; s/;.*//')
[ -n "$PKG" ] || PKG="com.fezzy.raindrops"
say "installing native plugins into $JAVA_DIR (package $PKG)"
for src in native/*.java; do
  [ -e "$src" ] || continue
  f=$(basename "$src")
  cp "$src" "$JAVA_DIR/$f" || die "copy $f failed"
  sed -i "1s/^package .*/package $PKG;/" "$JAVA_DIR/$f"
done
CAPJ=node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor
RG=0
if [ -f native/optional/RenderGuard.java ] && [ -f "$CAPJ/WebViewListener.java" ] \
   && grep -q "onRenderProcessGone" "$CAPJ/WebViewListener.java" \
   && grep -q "addWebViewListener" "$CAPJ/Bridge.java" \
   && grep -q "getActivity()" "$CAPJ/Bridge.java" \
   && grep -q "handleOnResume" "$CAPJ/Plugin.java"; then
  RG=1
  cp native/optional/RenderGuard.java "$JAVA_DIR/RenderGuard.java" || die "copy RenderGuard failed"
  sed -i "s/^package .*/package $PKG;/" "$JAVA_DIR/RenderGuard.java"
  say "RenderGuard installed (WebView renderer loss no longer kills the app)"
else
  rm -f "$JAVA_DIR/RenderGuard.java"
  say "RenderGuard skipped: this Capacitor version lacks the needed WebViewListener API (checked against node_modules source)"
fi
sed "s/PKG/$PKG/" native/MainActivity.java.stock > "$MA" || die "MainActivity write failed"
if [ "$RG" = 1 ]; then
  sed -i 's#/\*RENDERGUARD\*/#try { RenderGuard.install(getBridge()); } catch (Throwable ignored) { }#' "$MA"
else
  sed -i 's#/\*RENDERGUARD\*/##' "$MA"
fi
grep -q "RaindropsPlugin.class" "$MA" || die "MainActivity does not register the YouTube plugin"

# ---- Gradle: NewPipe Extractor + OkHttp + desugaring (idempotent, section-scoped)
NP="${NEWPIPE_VERSION:-}"
[ -n "$NP" ] || { [ -f scripts/newpipe.version ] && NP=$(tr -d '[:space:]' < scripts/newpipe.version); }
[ -n "$NP" ] || NP="v0.26.5"
case "$NP" in [vV0-9]*) ;; *) die "bad NewPipe version: $NP";; esac
# V1.9.7: confirm the NewPipe version exists on JitPack; if not (or JitPack is slow) fall back to older tags
np_ok() { curl -fsL --max-time "${2:-60}" -o /dev/null "https://jitpack.io/com/github/TeamNewPipe/NewPipeExtractor/$1/NewPipeExtractor-$1.pom"; }
if command -v curl >/dev/null 2>&1; then
  if np_ok "$NP" 150; then
    say "NewPipe $NP found on JitPack"
  else
    say "NewPipe $NP not confirmed on JitPack, trying fallbacks"
    FOUND=""
    for cand in v0.26.5 v0.26.4 v0.26.3 v0.26.2 v0.26.1 v0.26.0 v0.25.3 v0.25.2 v0.25.1 v0.25.0 v0.24.8 v0.24.7 v0.24.6 v0.24.5; do
      [ "$cand" = "$NP" ] && continue
      if np_ok "$cand" 90; then FOUND="$cand"; break; fi
    done
    if [ -n "$FOUND" ]; then say "using NewPipe $FOUND"; NP="$FOUND"; else say "no fallback answered, keeping $NP"; fi
  fi
fi
say "NewPipe version in use: $NP"
TOPG=android/build.gradle
APPG=android/app/build.gradle
[ -f "$TOPG" ] && [ -f "$APPG" ] || die "gradle files missing"
if ! grep -q "jitpack.io" "$TOPG"; then
  sed -i "/allprojects *{/,/^}/ s#mavenCentral()#mavenCentral()\n        maven { url 'https://jitpack.io' }#" "$TOPG"
  grep -q "jitpack.io" "$TOPG" || die "could not add jitpack to $TOPG"
  say "jitpack added"
fi
if ! grep -q "NewPipeExtractor" "$APPG"; then
  sed -i "/^android *{/ a\\    compileOptions {\n        coreLibraryDesugaringEnabled true\n        sourceCompatibility JavaVersion.VERSION_17\n        targetCompatibility JavaVersion.VERSION_17\n    }\n    packaging { resources { excludes += ['META-INF/DEPENDENCIES','META-INF/LICENSE*','META-INF/NOTICE*','META-INF/INDEX.LIST'] } }" "$APPG"
  sed -i "/^dependencies *{/ a\\    coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs_nio:2.1.5'\n    implementation 'com.github.TeamNewPipe:NewPipeExtractor:$NP'\n    implementation 'com.squareup.okhttp3:okhttp:4.12.0'" "$APPG"
  grep -q "NewPipeExtractor" "$APPG" || die "could not patch $APPG"
  say "NewPipeExtractor $NP wired in"
fi

# ---- V1.9.7: Gradle memory (NewPipe + desugaring need more than the 1.5 GB Capacitor default)
GP=android/gradle.properties
touch "$GP"
if grep -q '^org.gradle.jvmargs=' "$GP"; then
  sed -i 's#^org.gradle.jvmargs=.*#org.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=768m -Dfile.encoding=UTF-8#' "$GP"
else
  printf '\norg.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=768m -Dfile.encoding=UTF-8\n' >> "$GP"
fi
grep -q '^android.useAndroidX=' "$GP" || printf 'android.useAndroidX=true\n' >> "$GP"
grep -q '^android.enableJetifier=' "$GP" || printf 'android.enableJetifier=true\n' >> "$GP"

# ---- version code so each CI build installs over the last as an update
VC="${VERSION_CODE:-1}"; VN="${VERSION_NAME:-1.9.9.$VC}"
sed -i -E "s/versionCode [0-9]+/versionCode $VC/; s/versionName \"[^\"]*\"/versionName \"$VN\"/" "$APPG"

say "syncing web layer"
npx cap sync android || die "cap sync failed"
say "done."
