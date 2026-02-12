import argparse
import tarfile
from pathlib import Path


def create_backup(output: str) -> None:
    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with tarfile.open(output_path, "w:gz") as tar:
        for path in [Path("data"), Path("assets")]:
            if path.exists():
                tar.add(path, arcname=path.name)

    print(f"Backup created: {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create Artifactory backup")
    parser.add_argument("--output", default="backups/backup.tar.gz", help="Output tar.gz path")
    args = parser.parse_args()
    create_backup(args.output)


if __name__ == "__main__":
    main()
