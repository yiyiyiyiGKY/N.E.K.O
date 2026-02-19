/**
 * Layout Component
 *
 * Provides a consistent layout for all management pages
 */

import { Outlet, Link, useLocation } from "react-router-dom";
import { useState } from "react";
import "./Layout.css";

/**
 * Navigation menu items
 */
const NAV_ITEMS = [
  { path: "/", label: "主页", icon: "🏠" },
  { path: "/api_key", label: "API 密钥", icon: "🔑" },
  { path: "/chara_manager", label: "角色管理", icon: "👤" },
  { path: "/voice_clone", label: "语音克隆", icon: "🎤" },
  { path: "/memory_browser", label: "记忆浏览", icon: "🧠" },
  { path: "/steam_workshop_manager", label: "Steam Workshop", icon: "🎮" },
  { path: "/model_manager", label: "模型管理", icon: "🎭" },
  { path: "/l2d", label: "Live2D 设置", icon: "✨" },
];

/**
 * Layout Component
 */
export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <div className="sidebar-header">
          <h2>N.E.K.O</h2>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? "收起菜单" : "展开菜单"}
          >
            {sidebarOpen ? "◀" : "▶"}
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? "active" : ""}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {sidebarOpen && <span className="nav-label">{item.label}</span>}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
