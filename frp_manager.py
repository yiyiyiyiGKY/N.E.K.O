# -*- coding: utf-8 -*-
"""
FRP 反向代理生命周期管理。
由 launcher.py 调用，自动启动 frps + frpc，将 127.0.0.1 上的后端服务
通过 FRP 代理暴露到 0.0.0.0 供局域网设备（手机）访问。
首次运行时自动下载当前平台的 FRP 二进制。
"""
import io
import os
import platform
import signal
import stat
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.request
import zipfile
from typing import Optional

FRP_VERSION = "0.61.1"
BINARIES = ("frps", "frpc")


def _get_platform_key() -> str:
    """返回当前平台标识，如 darwin_arm64、windows_amd64 等。"""
    machine = platform.machine().lower()
    if sys.platform == "darwin":
        return "darwin_arm64" if machine == "arm64" else "darwin_amd64"
    elif sys.platform == "win32":
        return "windows_amd64"
    else:
        return "linux_arm64" if machine == "aarch64" else "linux_amd64"


def _get_frp_dir() -> str:
    """定位 FRP 二进制所在目录。"""
    # PyInstaller 打包环境
    if getattr(sys, "frozen", False):
        base = sys._MEIPASS if hasattr(sys, "_MEIPASS") else os.path.dirname(os.path.abspath(__file__))
        return os.path.join(base, "frp")

    # 开发环境：vendor/frp/<platform>/
    project_root = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(project_root, "vendor", "frp", _get_platform_key())


def _frp_binary(name: str) -> Optional[str]:
    """返回 frps/frpc 的完整路径，不存在则返回 None。"""
    d = _get_frp_dir()
    suffix = ".exe" if sys.platform == "win32" else ""
    path = os.path.join(d, name + suffix)
    return path if os.path.isfile(path) else None


# ── 自动下载 ──────────────────────────────────────────────


def _download_frp() -> bool:
    """下载当前平台的 FRP 二进制到 vendor/frp/<platform>/。
    仅在开发环境（非 frozen）下调用。成功返回 True。"""
    plat = _get_platform_key()
    is_windows = plat.startswith("windows")
    ext = "zip" if is_windows else "tar.gz"
    url = f"https://github.com/fatedier/frp/releases/download/v{FRP_VERSION}/frp_{FRP_VERSION}_{plat}.{ext}"
    dest_dir = _get_frp_dir()

    print(f"[FRP] Downloading FRP v{FRP_VERSION} for {plat} ...", flush=True)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "neko-frp-downloader/1.0"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = resp.read()
    except Exception as e:
        print(f"[FRP] Download failed: {e}", flush=True)
        return False

    os.makedirs(dest_dir, exist_ok=True)

    try:
        if is_windows:
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                for name in zf.namelist():
                    basename = os.path.basename(name)
                    stem = basename.removesuffix(".exe")
                    if stem in BINARIES:
                        target = os.path.join(dest_dir, basename)
                        with zf.open(name) as src, open(target, "wb") as dst:
                            dst.write(src.read())
                        print(f"[FRP]   -> {target}", flush=True)
        else:
            with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tf:
                for member in tf.getmembers():
                    basename = os.path.basename(member.name)
                    if basename in BINARIES:
                        target = os.path.join(dest_dir, basename)
                        with tf.extractfile(member) as src, open(target, "wb") as dst:
                            dst.write(src.read())
                        os.chmod(target, os.stat(target).st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
                        print(f"[FRP]   -> {target}", flush=True)
    except Exception as e:
        print(f"[FRP] Extract failed: {e}", flush=True)
        return False

    print(f"[FRP] Download complete.", flush=True)
    return True


def _ensure_frp_binaries() -> bool:
    """确保 FRP 二进制存在。打包环境直接检查，开发环境缺失则自动下载。"""
    if _frp_binary("frps") and _frp_binary("frpc"):
        return True

    # 打包环境下不能下载
    if getattr(sys, "frozen", False):
        print("[FRP] Binary not found in packaged environment.", flush=True)
        return False

    return _download_frp()


class FRPManager:
    """管理 frps + frpc 子进程。"""

    def __init__(self, main_server_port: int, frp_bind_port: int,
                 frp_proxy_port: int, token: str):
        self.main_server_port = main_server_port
        self.frp_bind_port = frp_bind_port
        self.frp_proxy_port = frp_proxy_port
        self.token = token
        self._tmpdir: Optional[tempfile.TemporaryDirectory] = None
        self._frps_proc: Optional[subprocess.Popen] = None
        self._frpc_proc: Optional[subprocess.Popen] = None

    # ── config generation ──────────────────────────────────────

    def _write_frps_toml(self, path: str):
        with open(path, "w", encoding="utf-8") as f:
            f.write(f'bindPort = {self.frp_bind_port}\n')
            f.write(f'auth.token = "{self.token}"\n')

    def _write_frpc_toml(self, path: str):
        with open(path, "w", encoding="utf-8") as f:
            f.write(f'serverAddr = "127.0.0.1"\n')
            f.write(f'serverPort = {self.frp_bind_port}\n')
            f.write(f'auth.token = "{self.token}"\n')
            f.write("\n")
            f.write("[[proxies]]\n")
            f.write('name = "neko-main"\n')
            f.write('type = "tcp"\n')
            f.write('localIP = "127.0.0.1"\n')
            f.write(f"localPort = {self.main_server_port}\n")
            f.write(f"remotePort = {self.frp_proxy_port}\n")

    # ── lifecycle ──────────────────────────────────────────────

    def start(self) -> bool:
        """启动 frps 和 frpc。缺少二进制时自动下载。成功返回 True。"""
        if not _ensure_frp_binaries():
            return False

        frps_bin = _frp_binary("frps")
        frpc_bin = _frp_binary("frpc")
        if not frps_bin or not frpc_bin:
            return False

        self._tmpdir = tempfile.TemporaryDirectory(prefix="neko_frp_")
        frps_cfg = os.path.join(self._tmpdir.name, "frps.toml")
        frpc_cfg = os.path.join(self._tmpdir.name, "frpc.toml")
        self._write_frps_toml(frps_cfg)
        self._write_frpc_toml(frpc_cfg)

        # 启动 frps
        try:
            self._frps_proc = subprocess.Popen(
                [frps_bin, "-c", frps_cfg],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
            )
            print(f"[FRP] frps started (PID: {self._frps_proc.pid}, bindPort={self.frp_bind_port})", flush=True)
        except Exception as e:
            print(f"[FRP] Failed to start frps: {e}", flush=True)
            return False

        # 等 frps 就绪
        time.sleep(0.5)
        if self._frps_proc.poll() is not None:
            stderr = self._frps_proc.stderr.read().decode(errors="replace") if self._frps_proc.stderr else ""
            print(f"[FRP] frps exited immediately: {stderr}", flush=True)
            return False

        # 启动 frpc
        try:
            self._frpc_proc = subprocess.Popen(
                [frpc_bin, "-c", frpc_cfg],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
            )
            print(f"[FRP] frpc started (PID: {self._frpc_proc.pid}, proxy 0.0.0.0:{self.frp_proxy_port} -> 127.0.0.1:{self.main_server_port})", flush=True)
        except Exception as e:
            print(f"[FRP] Failed to start frpc: {e}", flush=True)
            self.stop()
            return False

        time.sleep(0.5)
        if self._frpc_proc.poll() is not None:
            stderr = self._frpc_proc.stderr.read().decode(errors="replace") if self._frpc_proc.stderr else ""
            print(f"[FRP] frpc exited immediately: {stderr}", flush=True)
            self.stop()
            return False

        return True

    def stop(self):
        """优雅关闭 frpc 和 frps。"""
        for label, proc in [("frpc", self._frpc_proc), ("frps", self._frps_proc)]:
            if proc is None:
                continue
            try:
                if proc.poll() is None:
                    if sys.platform == "win32":
                        proc.terminate()
                    else:
                        proc.send_signal(signal.SIGTERM)
                    proc.wait(timeout=3)
                print(f"[FRP] {label} stopped", flush=True)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait(timeout=2)
                print(f"[FRP] {label} killed", flush=True)
            except Exception as e:
                print(f"[FRP] {label} cleanup error: {e}", flush=True)

        self._frpc_proc = None
        self._frps_proc = None

        if self._tmpdir:
            try:
                self._tmpdir.cleanup()
            except Exception:
                pass
            self._tmpdir = None

    def is_alive(self) -> bool:
        """检查 frps 和 frpc 是否都在运行。"""
        return (
            self._frps_proc is not None and self._frps_proc.poll() is None
            and self._frpc_proc is not None and self._frpc_proc.poll() is None
        )
