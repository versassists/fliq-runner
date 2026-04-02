"""
meshy_generate.py — Generate 3D assets via Meshy AI API
Uses Text-to-3D endpoint, polls for completion, downloads GLB,
and auto-compresses with gltf-transform.

Usage:
  python tools/meshy_generate.py "soft rounded rock cluster on circular base with subtle glow lines"
  python tools/meshy_generate.py "prompt here" --name rock1
  python tools/meshy_generate.py --status TASK_ID
"""

import os, sys, time, json, requests, subprocess
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("MESHY_API_KEY")
BASE_URL = "https://api.meshy.ai/openapi/v2"
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

OUTPUT_DIR = Path("3d asset")
OUTPUT_DIR.mkdir(exist_ok=True)


def create_task(prompt, name=None, art_style="realistic", topology="quad"):
    """Submit a text-to-3d task. Mode=preview first, then refine after."""
    payload = {
        "mode": "preview",
        "prompt": prompt,
        "art_style": art_style,
    }
    print(f"[Meshy] Submitting: {prompt[:80]}...")
    r = requests.post(f"{BASE_URL}/text-to-3d", headers=HEADERS, json=payload)
    r.raise_for_status()
    data = r.json()
    task_id = data.get("result") or data.get("id") or data
    print(f"[Meshy] Task created: {task_id}")
    return task_id


def check_status(task_id):
    """Check task status."""
    r = requests.get(f"{BASE_URL}/text-to-3d/{task_id}", headers=HEADERS)
    r.raise_for_status()
    return r.json()


def wait_for_completion(task_id, poll_interval=10, max_wait=600):
    """Poll until task completes or fails."""
    elapsed = 0
    while elapsed < max_wait:
        status = check_status(task_id)
        state = status.get("status", "UNKNOWN")
        progress = status.get("progress", 0)
        print(f"  [{elapsed}s] Status: {state} | Progress: {progress}%")

        if state == "SUCCEEDED":
            return status
        elif state in ("FAILED", "EXPIRED"):
            print(f"[Meshy] Task failed: {status.get('task_error', 'unknown')}")
            return None

        time.sleep(poll_interval)
        elapsed += poll_interval

    print("[Meshy] Timed out waiting for task")
    return None


def download_glb(status, name):
    """Download the GLB file from completed task."""
    model_urls = status.get("model_urls", {})
    glb_url = model_urls.get("glb") or model_urls.get("fbx")

    if not glb_url:
        print("[Meshy] No GLB URL in response")
        print(f"  Available: {list(model_urls.keys())}")
        return None

    filename = f"meshy_{name}.glb"
    filepath = OUTPUT_DIR / filename
    print(f"[Meshy] Downloading GLB → {filepath}")

    r = requests.get(glb_url, stream=True)
    r.raise_for_status()
    with open(filepath, "wb") as f:
        for chunk in r.iter_content(chunk_size=8192):
            f.write(chunk)

    size_mb = filepath.stat().st_size / (1024 * 1024)
    print(f"[Meshy] Downloaded: {size_mb:.1f} MB")
    return filepath


def compress_glb(filepath):
    """Compress GLB with gltf-transform (Draco + WebP textures at 512px)."""
    opt_path = filepath.parent / filepath.name.replace(".glb", "_opt.glb")
    print(f"[Compress] {filepath.name} → {opt_path.name}")

    try:
        result = subprocess.run(
            ["npx", "--yes", "@gltf-transform/cli", "optimize",
             str(filepath), str(opt_path),
             "--compress", "draco",
             "--texture-compress", "webp",
             "--texture-size", "512"],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode == 0:
            orig_mb = filepath.stat().st_size / (1024 * 1024)
            opt_mb = opt_path.stat().st_size / (1024 * 1024)
            print(f"[Compress] {orig_mb:.1f} MB → {opt_mb:.1f} MB ({(1 - opt_mb/orig_mb)*100:.0f}% reduction)")
            return opt_path
        else:
            print(f"[Compress] Failed: {result.stderr[:200]}")
            return filepath
    except Exception as e:
        print(f"[Compress] Error: {e}")
        return filepath


def generate(prompt, name=None):
    """Full pipeline: create → wait → download → compress."""
    if not name:
        name = prompt[:30].replace(" ", "_").replace("/", "_")

    task_id = create_task(prompt, name)
    print(f"\n[Meshy] Waiting for generation (can take 2-5 min)...\n")

    status = wait_for_completion(task_id)
    if not status:
        return None

    filepath = download_glb(status, name)
    if not filepath:
        return None

    opt_path = compress_glb(filepath)
    print(f"\n✅ Done! Asset ready: {opt_path}")
    return opt_path


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python tools/meshy_generate.py \"prompt\" [--name NAME]")
        print("       python tools/meshy_generate.py --status TASK_ID")
        sys.exit(1)

    if sys.argv[1] == "--status":
        task_id = sys.argv[2]
        status = check_status(task_id)
        print(json.dumps(status, indent=2))
    else:
        prompt = sys.argv[1]
        name = None
        if "--name" in sys.argv:
            idx = sys.argv.index("--name")
            name = sys.argv[idx + 1]
        generate(prompt, name)
