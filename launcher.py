# -*- coding: utf-8 -*-
"""
N.E.K.O. 统一启动器
启动所有服务器，等待它们准备就绪后启动主程序，并监控主程序状态
"""
import sys
import os
import io

# 强制 UTF-8 编码
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    
# 处理 PyInstaller 和 Nuitka 打包后的路径
if getattr(sys, 'frozen', False):
    # 运行在打包后的环境
    if hasattr(sys, '_MEIPASS'):
        # PyInstaller
        bundle_dir = sys._MEIPASS
    else:
        # Nuitka 或其他
        bundle_dir = os.path.dirname(os.path.abspath(__file__))
    
else:
    # 运行在正常 Python 环境
    bundle_dir = os.path.dirname(os.path.abspath(__file__))

sys.path.insert(0, bundle_dir)
os.chdir(bundle_dir)

import subprocess
import socket
import time
import threading
import itertools
import ctypes
import atexit
import signal
import json
from datetime import datetime, timezone
from typing import Dict
from multiprocessing import Process, freeze_support, Event
from config import APP_NAME, MAIN_SERVER_PORT, MEMORY_SERVER_PORT, TOOL_SERVER_PORT, FRP_BIND_PORT, FRP_PROXY_PORT, FRP_TOKEN
from frp_manager import FRPManager

JOB_HANDLE = None
_frp_manager: FRPManager | None = None
_cleanup_lock = threading.Lock()
_cleanup_done = False
DEFAULT_PORTS = {
    "MAIN_SERVER_PORT": MAIN_SERVER_PORT,
    "MEMORY_SERVER_PORT": MEMORY_SERVER_PORT,
    "TOOL_SERVER_PORT": TOOL_SERVER_PORT,
}
INTERNAL_DEFAULT_PORTS = {
    "AGENT_MQ_PORT": 48917,
    "MAIN_AGENT_EVENT_PORT": 48918,
}
# Keep this range reserved for known N.E.K.O defaults so fallback
# does not collide with other companion services.
AVOID_FALLBACK_PORTS = set(range(48911, 48919))


def _show_error_dialog(message: str):
    """在 Windows 打包场景显示错误弹窗。"""
    if sys.platform != 'win32':
        return
    try:
        ctypes.windll.user32.MessageBoxW(None, message, f"{APP_NAME} 启动失败", 0x10)
    except Exception:
        pass


def emit_frontend_event(event_type: str, payload: dict | None = None):
    """Emit machine-readable event line for Electron stdout parser."""
    envelope = {
        "source": "neko_launcher",
        "event": event_type,
        "ts": datetime.now(timezone.utc).isoformat(),
        "payload": payload or {},
    }
    print(f"NEKO_EVENT {json.dumps(envelope, ensure_ascii=True, separators=(',', ':'))}", flush=True)


def report_startup_failure(message: str, show_dialog: bool = True):
    """统一报告启动失败信息：终端 + （可选）弹窗。"""
    print(message, flush=True)
    emit_frontend_event("startup_failure", {"message": message})
    if show_dialog and getattr(sys, 'frozen', False):
        _show_error_dialog(message)


def _get_last_error() -> int:
    """获取最近一次 Win32 错误码。"""
    if sys.platform != 'win32':
        return 0
    return ctypes.windll.kernel32.GetLastError()


def setup_job_object():
    """
    创建 Windows Job Object 并将当前进程加入其中。
    设置 JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE 标志，
    这样当主进程被 kill 时，OS 会自动终止所有子进程，
    防止孤儿进程悬挂。
    """
    global JOB_HANDLE
    if sys.platform != 'win32':
        return None

    try:
        kernel32 = ctypes.windll.kernel32

        # Job Object 常量
        JOB_OBJECT_EXTENDED_LIMIT_INFORMATION = 9
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000

        # 先检查当前进程是否已在某个 Job 中（Steam 场景常见）
        is_in_job = ctypes.c_int(0)
        current_process = kernel32.GetCurrentProcess()
        if not kernel32.IsProcessInJob(current_process, None, ctypes.byref(is_in_job)):
            print(f"[Launcher] Warning: IsProcessInJob failed (err={_get_last_error()})", flush=True)
            is_in_job.value = 0

        # 创建 Job Object
        job = kernel32.CreateJobObjectW(None, None)
        if not job:
            print(f"[Launcher] Warning: Failed to create Job Object (err={_get_last_error()})", flush=True)
            return None

        # 设置 Job Object 信息
        # JOBOBJECT_EXTENDED_LIMIT_INFORMATION 结构体
        # 我们只需要设置 BasicLimitInformation.LimitFlags
        class JOBOBJECT_BASIC_LIMIT_INFORMATION(ctypes.Structure):
            _fields_ = [
                ('PerProcessUserTimeLimit', ctypes.c_int64),
                ('PerJobUserTimeLimit', ctypes.c_int64),
                ('LimitFlags', ctypes.c_uint32),
                ('MinimumWorkingSetSize', ctypes.c_size_t),
                ('MaximumWorkingSetSize', ctypes.c_size_t),
                ('ActiveProcessLimit', ctypes.c_uint32),
                ('Affinity', ctypes.c_size_t),
                ('PriorityClass', ctypes.c_uint32),
                ('SchedulingClass', ctypes.c_uint32),
            ]

        class IO_COUNTERS(ctypes.Structure):
            _fields_ = [
                ('ReadOperationCount', ctypes.c_uint64),
                ('WriteOperationCount', ctypes.c_uint64),
                ('OtherOperationCount', ctypes.c_uint64),
                ('ReadTransferCount', ctypes.c_uint64),
                ('WriteTransferCount', ctypes.c_uint64),
                ('OtherTransferCount', ctypes.c_uint64),
            ]

        class JOBOBJECT_EXTENDED_LIMIT_INFORMATION(ctypes.Structure):
            _fields_ = [
                ('BasicLimitInformation', JOBOBJECT_BASIC_LIMIT_INFORMATION),
                ('IoInfo', IO_COUNTERS),
                ('ProcessMemoryLimit', ctypes.c_size_t),
                ('JobMemoryLimit', ctypes.c_size_t),
                ('PeakProcessMemoryUsed', ctypes.c_size_t),
                ('PeakJobMemoryUsed', ctypes.c_size_t),
            ]

        info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION()
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE

        result = kernel32.SetInformationJobObject(
            job,
            JOB_OBJECT_EXTENDED_LIMIT_INFORMATION,
            ctypes.byref(info),
            ctypes.sizeof(info)
        )
        if not result:
            print(f"[Launcher] Warning: Failed to set Job Object info (err={_get_last_error()})", flush=True)
            kernel32.CloseHandle(job)
            return None

        # 将当前进程加入 Job Object
        result = kernel32.AssignProcessToJobObject(job, current_process)
        if not result:
            err = _get_last_error()
            if is_in_job.value:
                print(
                    f"[Launcher] Warning: Process is already inside another Job; "
                    f"nested Job assignment failed (err={err}). "
                    "Will rely on explicit process-tree cleanup fallback.",
                    flush=True
                )
            else:
                print(f"[Launcher] Warning: Failed to assign process to Job Object (err={err})", flush=True)
            kernel32.CloseHandle(job)
            return None

        # 保持 handle 在进程生命周期内有效（模块级引用）
        # 进程退出时句柄会关闭，触发 KILL_ON_JOB_CLOSE
        JOB_HANDLE = job
        print("[Launcher] Job Object created - child processes will auto-terminate on exit", flush=True)
        return job

    except Exception as e:
        print(f"[Launcher] Warning: Job Object setup failed: {e}", flush=True)
        return None

# 服务器配置
SERVERS = [
    {
        'name': 'Memory Server',
        'module': 'memory_server',
        'port': MEMORY_SERVER_PORT,
        'process': None,
        'ready_event': None,
    },
    {
        'name': 'Agent Server', 
        'module': 'agent_server',
        'port': TOOL_SERVER_PORT,
        'process': None,
        'ready_event': None,
    },
    {
        'name': 'Main Server',
        'module': 'main_server',
        'port': MAIN_SERVER_PORT,
        'process': None,
        'ready_event': None,
    },
]

# 不再启动主程序，用户自己启动 lanlan_frd.exe

def run_memory_server(ready_event: Event):
    """运行 Memory Server"""
    try:
        # 确保工作目录正确
        if getattr(sys, 'frozen', False):
            if hasattr(sys, '_MEIPASS'):
                # PyInstaller
                os.chdir(sys._MEIPASS)
            else:
                # Nuitka
                os.chdir(os.path.dirname(os.path.abspath(__file__)))
            # 禁用 typeguard（子进程需要重新禁用）
            try:
                import typeguard
                def dummy_typechecked(func=None, **kwargs):
                    return func if func else (lambda f: f)
                typeguard.typechecked = dummy_typechecked
                if hasattr(typeguard, '_decorators'):
                    typeguard._decorators.typechecked = dummy_typechecked
            except: # noqa
                pass
        
        import memory_server
        import uvicorn
        
        print(f"[Memory Server] Starting on port {MEMORY_SERVER_PORT}")
        
        # 使用 Server 对象，在启动后通知父进程
        config = uvicorn.Config(
            app=memory_server.app,
            host="127.0.0.1",
            port=MEMORY_SERVER_PORT,
            log_level="error"
        )
        server = uvicorn.Server(config)
        
        # 在后台线程中运行服务器
        import asyncio
        
        async def run_with_notify():
            # 启动服务器
            await server.serve()
        
        # 启动线程来运行服务器，并在启动后通知
        def run_server():
            # 创建事件循环
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            # 添加启动完成的回调
            async def startup():
                print(f"[Memory Server] Running on port {MEMORY_SERVER_PORT}")
                ready_event.set()
            
            # 将 startup 添加到服务器的启动事件
            server.config.app.add_event_handler("startup", startup)
            
            # 运行服务器
            loop.run_until_complete(server.serve())
        
        run_server()
        
    except Exception as e:
        print(f"Memory Server error: {e}")
        import traceback
        traceback.print_exc()

def run_agent_server(ready_event: Event):
    """运行 Agent Server (不需要等待初始化)"""
    try:
        # 确保工作目录正确
        if getattr(sys, 'frozen', False):
            if hasattr(sys, '_MEIPASS'):
                # PyInstaller
                os.chdir(sys._MEIPASS)
            else:
                # Nuitka
                os.chdir(os.path.dirname(os.path.abspath(__file__)))
            # 禁用 typeguard（子进程需要重新禁用）
            try:
                import typeguard
                def dummy_typechecked(func=None, **kwargs):
                    return func if func else (lambda f: f)
                typeguard.typechecked = dummy_typechecked
                if hasattr(typeguard, '_decorators'):
                    typeguard._decorators.typechecked = dummy_typechecked
            except: # noqa
                pass
        
        import agent_server
        import uvicorn
        
        print(f"[Agent Server] Starting on port {TOOL_SERVER_PORT}")
        
        # Agent Server 不需要等待，立即通知就绪
        ready_event.set()
        
        uvicorn.run(agent_server.app, host="127.0.0.1", port=TOOL_SERVER_PORT, log_level="error")
    except Exception as e:
        print(f"Agent Server error: {e}")
        import traceback
        traceback.print_exc()

def run_main_server(ready_event: Event):
    """运行 Main Server"""
    try:
        # 确保工作目录正确
        if getattr(sys, 'frozen', False):
            if hasattr(sys, '_MEIPASS'):
                # PyInstaller
                os.chdir(sys._MEIPASS)
            else:
                # Nuitka
                os.chdir(os.path.dirname(os.path.abspath(__file__)))
        
        print("[Main Server] Importing main_server module...")
        import main_server
        import uvicorn
        
        print(f"[Main Server] Starting on port {MAIN_SERVER_PORT}")
        
        # 直接运行 FastAPI app，不依赖 main_server 的 __main__ 块
        config = uvicorn.Config(
            app=main_server.app,
            host="127.0.0.1",
            port=MAIN_SERVER_PORT,
            log_level="error",
            loop="asyncio",
            reload=False,
        )
        server = uvicorn.Server(config)
        
        # 添加启动完成的回调
        async def startup():
            print(f"[Main Server] Running on port {MAIN_SERVER_PORT}")
            ready_event.set()
        
        # 将 startup 添加到服务器的启动事件
        main_server.app.add_event_handler("startup", startup)
        
        # 运行服务器
        server.run()
    except Exception as e:
        print(f"Main Server error: {e}")
        import traceback
        traceback.print_exc()

def check_port(port: int, timeout: float = 0.5) -> bool:
    """检查端口是否已开放"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex(('127.0.0.1', port))
        sock.close()
        return result == 0
    except: # noqa
        return False


def get_port_owners(port: int) -> list[int]:
    """查询监听指定端口的进程 PID 列表（尽力而为）。"""
    pids: set[int] = set()
    try:
        if sys.platform == 'win32':
            result = subprocess.run(
                ["netstat", "-ano", "-p", "tcp"],
                capture_output=True,
                text=True,
                timeout=3,
                check=False,
            )
            needle = f":{port}"
            for raw in result.stdout.splitlines():
                line = raw.strip()
                if "LISTENING" not in line or needle not in line:
                    continue
                parts = line.split()
                if not parts:
                    continue
                pid_str = parts[-1]
                if pid_str.isdigit():
                    pids.add(int(pid_str))
        else:
            result = subprocess.run(
                ["lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN", "-t"],
                capture_output=True,
                text=True,
                timeout=3,
                check=False,
            )
            for line in result.stdout.splitlines():
                s = line.strip()
                if s.isdigit():
                    pids.add(int(s))
    except Exception:
        pass
    return sorted(pids)


def _is_port_bindable(port: int) -> bool:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind(("127.0.0.1", port))
        return True
    except OSError:
        return False
    finally:
        sock.close()


def _pick_fallback_port(preferred_port: int, reserved: set[int]) -> int | None:
    # 1) Prefer nearby ports first
    for port in range(preferred_port + 1, min(preferred_port + 101, 65535)):
        if port in reserved or port in AVOID_FALLBACK_PORTS:
            continue
        if _is_port_bindable(port):
            return port
    # 2) Fallback to any OS-assigned free port
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.bind(("127.0.0.1", 0))
        port = int(sock.getsockname()[1])
        sock.close()
        if port not in reserved and port not in AVOID_FALLBACK_PORTS:
            return port
    except Exception:
        pass
    return None


def apply_port_strategy() -> bool:
    """Keep default ports when possible; auto-avoid conflicts when needed."""
    global MAIN_SERVER_PORT, MEMORY_SERVER_PORT, TOOL_SERVER_PORT, FRP_BIND_PORT, FRP_PROXY_PORT
    chosen: dict[str, int] = {}
    chosen_internal: dict[str, int] = {}
    fallback_details: list[dict] = []
    internal_fallback_details: list[dict] = []
    reserved: set[int] = set()

    for key in ("MEMORY_SERVER_PORT", "TOOL_SERVER_PORT", "MAIN_SERVER_PORT"):
        preferred = int(DEFAULT_PORTS[key])
        if preferred not in reserved and _is_port_bindable(preferred):
            chosen[key] = preferred
            reserved.add(preferred)
            continue

        owners = get_port_owners(preferred)
        fallback = _pick_fallback_port(preferred, reserved)
        if fallback is None:
            report_startup_failure(
                f"Startup failed: no fallback port available for {key} (preferred={preferred}, owners={owners})"
            )
            return False

        chosen[key] = fallback
        reserved.add(fallback)
        fallback_details.append(
            {
                "port_key": key,
                "preferred": preferred,
                "selected": fallback,
                "owners": owners,
            }
        )

    MAIN_SERVER_PORT = chosen["MAIN_SERVER_PORT"]
    MEMORY_SERVER_PORT = chosen["MEMORY_SERVER_PORT"]
    TOOL_SERVER_PORT = chosen["TOOL_SERVER_PORT"]

    for key, preferred in INTERNAL_DEFAULT_PORTS.items():
        if preferred not in reserved and _is_port_bindable(preferred):
            chosen_internal[key] = preferred
            reserved.add(preferred)
            continue

        owners = get_port_owners(preferred)
        fallback = _pick_fallback_port(preferred, reserved)
        if fallback is None:
            report_startup_failure(
                f"Startup failed: no fallback port available for {key} (preferred={preferred}, owners={owners})"
            )
            return False

        chosen_internal[key] = fallback
        reserved.add(fallback)
        internal_fallback_details.append(
            {
                "port_key": key,
                "preferred": preferred,
                "selected": fallback,
                "owners": owners,
            }
        )

    for key, value in chosen.items():
        os.environ[f"NEKO_{key}"] = str(value)
    for key, value in chosen_internal.items():
        os.environ[f"NEKO_{key}"] = str(value)

    # FRP 端口冲突检测
    frp_fallback_details: list[dict] = []
    for key, preferred in (("FRP_BIND_PORT", FRP_BIND_PORT), ("FRP_PROXY_PORT", FRP_PROXY_PORT)):
        if preferred not in reserved and _is_port_bindable(preferred):
            reserved.add(preferred)
            if key == "FRP_BIND_PORT":
                FRP_BIND_PORT = preferred
            else:
                FRP_PROXY_PORT = preferred
            continue

        owners = get_port_owners(preferred)
        fallback = _pick_fallback_port(preferred, reserved)
        if fallback is None:
            print(f"[Launcher] Warning: no fallback for {key} (preferred={preferred}), FRP will be skipped", flush=True)
            break
        reserved.add(fallback)
        if key == "FRP_BIND_PORT":
            FRP_BIND_PORT = fallback
        else:
            FRP_PROXY_PORT = fallback
        frp_fallback_details.append({"port_key": key, "preferred": preferred, "selected": fallback, "owners": owners})

    if frp_fallback_details:
        print(f"[Launcher] FRP port fallback applied: {frp_fallback_details}", flush=True)

    for server in SERVERS:
        if server["module"] == "memory_server":
            server["port"] = MEMORY_SERVER_PORT
        elif server["module"] == "agent_server":
            server["port"] = TOOL_SERVER_PORT
        elif server["module"] == "main_server":
            server["port"] = MAIN_SERVER_PORT

    emit_frontend_event(
        "port_plan",
        {
            "defaults": DEFAULT_PORTS,
            "selected": chosen,
            "internal_defaults": INTERNAL_DEFAULT_PORTS,
            "internal_selected": chosen_internal,
            "fallbacks": fallback_details,
            "internal_fallbacks": internal_fallback_details,
            "fallback_applied": bool(fallback_details or internal_fallback_details),
        },
    )
    if fallback_details or internal_fallback_details:
        print(
            f"[Launcher] Port fallback applied: public={fallback_details}, internal={internal_fallback_details}",
            flush=True,
        )
    else:
        print("[Launcher] Preferred ports available; no fallback needed.", flush=True)
    return True

def show_spinner(stop_event: threading.Event, message: str = "正在启动服务器"):
    """显示转圈圈动画"""
    spinner = itertools.cycle(['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'])
    while not stop_event.is_set():
        sys.stdout.write(f'\r{message}... {next(spinner)} ')
        sys.stdout.flush()
        time.sleep(0.1)
    sys.stdout.write('\r' + ' ' * 60 + '\r')  # 清除动画行
    sys.stdout.write('\n')  # 换行，确保后续输出在新行
    sys.stdout.flush()

def start_server(server: Dict) -> bool:
    """启动单个服务器"""
    try:
        port = server.get('port')
        if isinstance(port, int) and check_port(port):
            owner_pids = get_port_owners(port)
            owner_suffix = f", owner_pids={owner_pids}" if owner_pids else ""
            report_startup_failure(f"Start failed: {server['name']} port {port} already in use{owner_suffix}")
            return False

        # 根据模块名选择启动函数
        if server['module'] == 'memory_server':
            target_func = run_memory_server
        elif server['module'] == 'agent_server':
            target_func = run_agent_server
        elif server['module'] == 'main_server':
            target_func = run_main_server
        else:
            report_startup_failure(f"Start failed: {server['name']} has unknown module")
            return False
        
        # 创建进程间同步事件
        server['ready_event'] = Event()
        
        # 使用 multiprocessing 启动服务器
        # 注意：不能设置 daemon=True，因为 main_server 自己会创建子进程
        server['process'] = Process(target=target_func, args=(server['ready_event'],), daemon=False)
        server['process'].start()
        
        print(f"✓ {server['name']} 已启动 (PID: {server['process'].pid})", flush=True)
        return True
    except Exception as e:
        report_startup_failure(f"Start failed: {server['name']} exception: {e}")
        return False

def wait_for_servers(timeout: int = 60) -> bool:
    """等待所有服务器启动完成"""
    print("\n等待服务器准备就绪...", flush=True)
    
    # 启动动画线程
    stop_spinner = threading.Event()
    spinner_thread = threading.Thread(target=show_spinner, args=(stop_spinner, "检查服务器状态"))
    spinner_thread.daemon = True
    spinner_thread.start()
    
    start_time = time.time()
    all_ready = False
    
    # 第一步：等待所有端口就绪
    while time.time() - start_time < timeout:
        ready_count = 0
        for server in SERVERS:
            if check_port(server['port']):
                ready_count += 1
        
        if ready_count == len(SERVERS):
            break
        
        time.sleep(0.5)
    
    # 第二步：等待所有服务器的 ready_event（同步初始化完成）
    if ready_count == len(SERVERS):
        for server in SERVERS:
            remaining_time = timeout - (time.time() - start_time)
            if remaining_time > 0:
                if server['ready_event'].wait(timeout=remaining_time):
                    continue
                else:
                    # 超时
                    break
        else:
            # 所有服务器都就绪了
            all_ready = True
    
    # 停止动画
    stop_spinner.set()
    spinner_thread.join()
    
    if all_ready:
        print("\n", flush=True)
        print("=" * 60, flush=True)
        print("✓✓✓  所有服务器已准备就绪！  ✓✓✓", flush=True)
        print("=" * 60, flush=True)
        print("\n", flush=True)
        return True
    else:
        print("\n", flush=True)
        print("=" * 60, flush=True)
        print("✗ 服务器启动超时，请检查日志文件", flush=True)
        print("=" * 60, flush=True)
        print("\n", flush=True)
        report_startup_failure("Startup timeout: at least one service did not become ready")
        # 显示未就绪的服务器
        for server in SERVERS:
            if not server['ready_event'].is_set():
                print(f"  - {server['name']} 初始化未完成", flush=True)
            elif not check_port(server['port']):
                print(f"  - {server['name']} 端口 {server['port']} 未就绪", flush=True)
        return False


def cleanup_servers():
    """清理所有服务器进程"""
    global _cleanup_done
    with _cleanup_lock:
        if _cleanup_done:
            return
        _cleanup_done = True

    print("\n正在关闭服务器...", flush=True)
    # 先关闭 FRP 代理
    if _frp_manager is not None:
        _frp_manager.stop()

    for server in SERVERS:
        proc = server.get('process')
        if not proc:
            continue

        try:
            # 先尝试温和终止
            if proc.is_alive():
                proc.terminate()
                proc.join(timeout=3)

            # 第二步：仍存活则 kill
            if proc.is_alive():
                proc.kill()
                proc.join(timeout=2)

            # 第三步：Windows 下兜底强杀整个进程树，防止孙进程残留
            pid = proc.pid
            if pid and sys.platform == 'win32':
                subprocess.run(
                    ["taskkill", "/PID", str(pid), "/T", "/F"],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    check=False
                )

            print(f"✓ {server['name']} 已关闭", flush=True)
        except Exception as e:
            print(f"✗ {server['name']} 关闭失败: {e}", flush=True)

    # 显式关闭 Job handle（如果存在）
    if JOB_HANDLE and sys.platform == 'win32':
        try:
            ctypes.windll.kernel32.CloseHandle(JOB_HANDLE)
        except Exception:
            pass


def _handle_termination_signal(signum, _frame):
    """处理终止信号，尽量保证清理逻辑被触发。"""
    print(f"\n收到终止信号 ({signum})，正在关闭...", flush=True)
    cleanup_servers()
    raise SystemExit(0)


def register_shutdown_hooks():
    """注册退出钩子，覆盖更多退出路径。"""
    atexit.register(cleanup_servers)
    if sys.platform == 'win32':
        try:
            signal.signal(signal.SIGTERM, _handle_termination_signal)
        except Exception:
            pass

def main():
    """主函数"""
    # 支持 multiprocessing 在 Windows 上的打包
    freeze_support()
    if not apply_port_strategy():
        return 1
    register_shutdown_hooks()
    
    # 创建 Job Object，确保主进程被 kill 时子进程也会被终止
    setup_job_object()
    
    print("=" * 60, flush=True)
    print("N.E.K.O. 服务器启动器", flush=True)
    print("=" * 60, flush=True)
    
    try:
        # 1. 启动所有服务器
        print("\n正在启动服务器...\n", flush=True)
        all_started = True
        for server in SERVERS:
            if not start_server(server):
                all_started = False
                break
        
        if not all_started:
            print("\n启动失败，正在清理...", flush=True)
            report_startup_failure("Startup aborted: at least one service failed to start", show_dialog=False)
            cleanup_servers()
            return 1
        
        # 2. 等待服务器准备就绪
        if not wait_for_servers():
            print("\n启动失败，正在清理...", flush=True)
            report_startup_failure("Startup aborted: services did not become ready before timeout", show_dialog=False)
            cleanup_servers()
            return 1
        
        # 3. 启动 FRP 反向代理
        global _frp_manager
        _frp_manager = FRPManager(
            main_server_port=MAIN_SERVER_PORT,
            frp_bind_port=FRP_BIND_PORT,
            frp_proxy_port=FRP_PROXY_PORT,
            token=FRP_TOKEN,
        )
        frp_ok = _frp_manager.start()
        if not frp_ok:
            print("[Launcher] FRP 启动失败，局域网设备将无法连接。后端仍可通过 localhost 访问。", flush=True)

        # 4. 服务器已启动，等待用户操作
        print("", flush=True)
        print("=" * 60, flush=True)
        print("  🎉 所有服务器已启动完成！", flush=True)
        print("\n  现在你可以：", flush=True)
        print("  1. 启动 lanlan_frd.exe 使用系统", flush=True)
        print(f"  2. 在浏览器访问 http://localhost:{MAIN_SERVER_PORT}", flush=True)
        if frp_ok:
            print(f"  3. 手机端连接 <电脑IP>:{FRP_PROXY_PORT}", flush=True)
        print("\n  按 Ctrl+C 关闭所有服务器", flush=True)
        print("=" * 60, flush=True)
        print("", flush=True)
        
        # 持续运行，监控服务器状态
        while True:
            time.sleep(1)
            # 检查服务器是否还活着
            all_alive = all(
                server['process'] and server['process'].is_alive()
                for server in SERVERS
            )
            if not all_alive:
                print("\n检测到服务器异常退出！", flush=True)
                break
            # 检查 FRP 是否还活着
            if _frp_manager and frp_ok and not _frp_manager.is_alive():
                print("\n[FRP] 检测到 FRP 进程异常退出，局域网连接可能中断", flush=True)
                frp_ok = False
        
    except KeyboardInterrupt:
        print("\n\n收到中断信号，正在关闭...", flush=True)
    except Exception as e:
        print(f"\n发生错误: {e}", flush=True)
        report_startup_failure(f"Launcher unhandled exception: {e}")
    finally:
        cleanup_servers()
        print("\n所有服务器已关闭", flush=True)
        print("再见！\n", flush=True)
    
    return 0

if __name__ == "__main__":
    sys.exit(main())

