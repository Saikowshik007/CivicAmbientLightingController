"""Build with an existing JDK 17+ and unpacked official Android SDK packages.

python build-local.py --jdk PATH --platform PATH --build-tools PATH --work PATH
The Gradle project is also provided for Android Studio. No Gradle is needed here.
"""
import argparse
import hashlib
import os
from pathlib import Path
import subprocess
import zipfile
import shutil


def run(*args):
    subprocess.run([str(x) for x in args], check=True)


def build(options):
    project = Path(__file__).resolve().parent.parent
    import re
    config=(project / 'app/build.gradle').read_text(encoding='utf8')
    version=re.search(r"versionName '([^']+)'",config).group(1)
    code=re.search(r'versionCode (\d+)',config).group(1)
    output=Path(options.output_dir).resolve() if options.output_dir else project / 'dist'
    output.mkdir(parents=True,exist_ok=True)
    work = Path(options.work).resolve()
    work.mkdir(parents=True, exist_ok=True)
    jdk = Path(options.jdk).resolve()
    platform = Path(options.platform).resolve()
    tools = Path(options.build_tools).resolve()
    java, javac = jdk / 'bin/java.exe', jdk / 'bin/javac.exe'
    jar = platform / 'android.jar'
    source = project / 'app/src/main'
    classes, dex = work / 'classes', work / 'dex'
    if classes.resolve().parent != work or classes.name != 'classes':
        raise ValueError('Invalid classes scratch directory')
    if classes.exists():
        shutil.rmtree(classes)
    classes.mkdir()
    if dex.resolve().parent != work or dex.name != 'dex':
        raise ValueError('Invalid dex scratch directory')
    if dex.exists():
        shutil.rmtree(dex)
    dex.mkdir()
    files = sorted((source / 'java').rglob('*.java'))
    libraries = sorted((project / 'app/libs').glob('*.jar'))
    compile_args = work / 'javac.args'
    args = ['--release', '17', '-encoding', 'UTF-8', '-classpath', os.pathsep.join(str(p) for p in [jar, *libraries]), '-d', str(classes)]
    args.extend(str(p) for p in files)
    compile_args.write_text('\n'.join('"' + x.replace('\\', '/') + '"' for x in args), encoding='utf-8')
    run(javac, '@' + str(compile_args))
    run(java, '-cp', tools / 'lib/d8.jar', 'com.android.tools.r8.D8',
        '--min-api', '33', '--lib', jar, '--output', dex, *sorted(classes.rglob('*.class')), *libraries)
    resources = work / 'resources.zip'
    run(tools / 'aapt2.exe', 'compile', '--dir', source / 'res', '-o', resources)
    manifest = work / 'AndroidManifest.xml'
    manifest.write_text((source / 'AndroidManifest.xml').read_text(encoding='utf-8').replace(
        '<manifest ', '<manifest package="dev.civic.signalcheck" ', 1), encoding='utf-8')
    unsigned = work / 'unsigned.apk'
    run(tools / 'aapt2.exe', 'link', '-I', jar, '--manifest', manifest,
        '--min-sdk-version', '33', '--target-sdk-version', '35',
        '--version-code', code, '--version-name', version, '-A', source / 'assets', '-o', unsigned, resources)
    with zipfile.ZipFile(unsigned, 'a', compression=zipfile.ZIP_DEFLATED) as archive:
        for p in sorted(dex.glob('*.dex')):
            archive.write(p, p.name)
    aligned = work / 'aligned.apk'
    run(tools / 'zipalign.exe', '-f', '4', unsigned, aligned)
    # Development-only key. Keep private signing keys outside the source bundle.
    key = Path(options.keystore).resolve() if options.keystore else work / 'ambient-development.p12'
    if not key.exists():
        run(jdk / 'bin/keytool.exe', '-genkeypair', '-keystore', key,
            '-storepass', 'android', '-keypass', 'android', '-alias', 'diagnostic',
            '-keyalg', 'RSA', '-keysize', '2048', '-validity', '3650',
            '-dname', 'CN=Civic Signal Check Development')
    apk = output / ('Civic-Ambient-' + version + '.apk')
    signer = tools / 'lib/apksigner.jar'
    run(java, '-jar', signer, 'sign', '--ks', key, '--ks-key-alias', 'diagnostic',
        '--ks-pass', 'pass:android', '--key-pass', 'pass:android', '--out', apk, aligned)
    run(java, '-jar', signer, 'verify', '--verbose', '--print-certs', apk)
    run(tools / 'zipalign.exe', '-c', '4', apk)
    print('APK:', apk)
    print('SHA256:', hashlib.sha256(apk.read_bytes()).hexdigest())
    if options.bundletool:
        proto = work / 'proto.apk'
        run(tools / 'aapt2.exe', 'link', '--proto-format', '-I', jar, '--manifest', manifest,
            '--min-sdk-version', '33', '--target-sdk-version', '35',
            '--version-code', code, '--version-name', version, '-A', source / 'assets', '-o', proto, resources)
        module = work / 'base.zip'
        with zipfile.ZipFile(proto) as compiled, zipfile.ZipFile(module, 'w', zipfile.ZIP_DEFLATED) as archive:
            for name in compiled.namelist():
                if name.startswith('META-INF/'):
                    continue
                target = 'manifest/AndroidManifest.xml' if name == 'AndroidManifest.xml' else name
                archive.writestr(target, compiled.read(name))
            for p in sorted(dex.glob('*.dex')):
                archive.write(p, 'dex/' + p.name)
        unsigned_bundle = work / 'unsigned.aab'
        run(java, '-jar', Path(options.bundletool).resolve(), 'build-bundle',
            '--modules=' + str(module), '--output=' + str(unsigned_bundle), '--overwrite')
        bundle = output / ('Civic-Ambient-' + version + '.aab')
        signing_jdk = Path(options.signing_jdk).resolve() if options.signing_jdk else jdk
        run(signing_jdk / 'bin/jarsigner.exe', '-keystore', key, '-storepass', 'android',
            '-keypass', 'android', '-signedjar', bundle, unsigned_bundle, 'diagnostic')
        run(java, '-jar', Path(options.bundletool).resolve(), 'validate', '--bundle=' + str(bundle))
        print('AAB:', bundle)
        print('SHA256:', hashlib.sha256(bundle.read_bytes()).hexdigest())


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--jdk', required=True)
    parser.add_argument('--platform', required=True)
    parser.add_argument('--build-tools', required=True)
    parser.add_argument('--work', required=True)
    parser.add_argument('--bundletool')
    parser.add_argument('--output-dir')
    parser.add_argument('--keystore', help='Existing development upload keystore, never commit this file')
    parser.add_argument('--signing-jdk', help='Full JDK with jarsigner, if the build JDK is a trimmed runtime')
    build(parser.parse_args())
