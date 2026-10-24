from pathlib import Path
p = Path('android/app/build.gradle')
text = p.read_text()

if 'signingConfigs' not in text:
    text = text.replace(
        "    buildTypes {\n",
        """    signingConfigs {
        release {
            storeFile file("release.keystore")
            storePassword System.getenv("KEYSTORE_PASS")
            keyAlias System.getenv("KEY_ALIAS")
            keyPassword System.getenv("KEYSTORE_PASS")
        }
    }
    buildTypes {
""",
        1,
    )

if 'signingConfig signingConfigs.release' not in text:
    text = text.replace(
        "        release {\n",
        "        release {\n            signingConfig signingConfigs.release\n",
        1,
    )
p.write_text(text)
