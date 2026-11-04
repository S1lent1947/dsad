"""Construiește pluginul fără Gradle, folosind jar-urile unui PyCharm instalat.

Folosire:
    python build.py "C:\\Program Files\\JetBrains\\PyCharm 2026.1.1" [folder_de_lucru]

Rezultat: dsad-pycharm.zip lângă acest fișier (se instalează cu Install Plugin from Disk).
"""
import glob
import os
import subprocess
import sys
import tempfile
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    pycharm = sys.argv[1]
    work = sys.argv[2] if len(sys.argv) > 2 else tempfile.mkdtemp(prefix="dsad-plugin-")
    classes = os.path.join(work, "classes")
    os.makedirs(classes, exist_ok=True)

    javac = os.path.join(pycharm, "jbr", "bin", "javac.exe" if os.name == "nt" else "javac")
    sources = glob.glob(os.path.join(HERE, "src", "main", "java", "**", "*.java"), recursive=True)
    classpath = os.path.join(pycharm, "lib", "*")
    cmd = [javac, "-source", "17", "-target", "17", "-encoding", "UTF-8", "-Xlint:-options",
           "-cp", classpath, "-d", classes] + sources
    subprocess.run(cmd, check=True)

    jar_path = os.path.join(work, "dsad-pycharm.jar")
    with zipfile.ZipFile(jar_path, "w", zipfile.ZIP_DEFLATED) as jar:
        jar.writestr("META-INF/MANIFEST.MF", "Manifest-Version: 1.0\r\n\r\n")
        for root in (classes, os.path.join(HERE, "src", "main", "resources")):
            for folder, _, names in os.walk(root):
                for name in sorted(names):
                    full = os.path.join(folder, name)
                    jar.write(full, os.path.relpath(full, root).replace(os.sep, "/"))

    out_zip = os.path.join(HERE, "dsad-pycharm.zip")
    with zipfile.ZipFile(out_zip, "w", zipfile.ZIP_DEFLATED) as dist:
        dist.write(jar_path, "dsad-pycharm/lib/dsad-pycharm.jar")
    print("gata:", out_zip)


if __name__ == "__main__":
    main()
