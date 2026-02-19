/**
 * Steam Workshop Page
 *
 * Migrated from templates/steam_workshop_manager.html
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { ChangeEvent } from "react";
import "./SteamWorkshop.css";

interface WorkshopItem {
  id: string;
  name: string;
  type: "model" | "voice";
  author: string;
  fileSize: string;
  subscribed: boolean;
  downloaded: boolean;
  lastUpdated: string;
}

type SortOption = "name_asc" | "name_desc" | "date_asc" | "date_desc" | "size_asc" | "size_desc";
type TabType = "subscriptions" | "character-cards";

export default function SteamWorkshop() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("subscriptions");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<WorkshopItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name_asc");

  useEffect(() => {
    loadItems();
  }, [activeTab]);

  const loadItems = async () => {
    setLoading(true);
    try {
      // TODO: Implement API call
      // const response = await fetch("/api/steam/workshop");
      // const data = await response.json();
      // setItems(data);

      // Mock data
      await new Promise((resolve) => setTimeout(resolve, 500));
      setItems([
        {
          id: "1",
          name: "Yui Live2D Model",
          type: "model",
          author: "Creator1",
          fileSize: "15 MB",
          subscribed: true,
          downloaded: true,
          lastUpdated: "2026-02-19",
        },
        {
          id: "2",
          name: "Miku Voice Pack",
          type: "voice",
          author: "Creator2",
          fileSize: "8 MB",
          subscribed: true,
          downloaded: false,
          lastUpdated: "2026-02-18",
        },
      ]);
    } catch (error) {
      console.error("Failed to load items:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (itemId: string) => {
    try {
      // TODO: Implement API call
      console.log("Downloading item:", itemId);
      alert("开始下载...");
    } catch (error) {
      console.error("Failed to download:", error);
    }
  };

  const handleUnsubscribe = async (itemId: string) => {
    if (!confirm("确定要取消订阅吗？")) return;

    try {
      // TODO: Implement API call
      console.log("Unsubscribing from item:", itemId);
      setItems(items.filter((item) => item.id !== itemId));
      alert("已取消订阅");
    } catch (error) {
      console.error("Failed to unsubscribe:", error);
    }
  };

  const handleClose = () => {
    navigate("/");
  };

  const filteredItems = items
    .filter((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "date_asc":
          return new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime();
        case "date_desc":
          return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
        default:
          return 0;
      }
    });

  return (
    <div className="steam-workshop-page">
      <div className="page-container">
        {/* Header */}
        <div className="page-header">
          <h2>Steam 创意工坊管理</h2>
          <button className="close-button" onClick={handleClose} title="关闭">
            ✕
          </button>
        </div>

        <div className="page-content">
          {/* Info Section */}
          <div className="info-section">
            <p>通过此页面，您可以浏览、订阅、下载和管理Steam创意工坊中的Live2D模型和声音。</p>
            <p className="note">如有语音音色请前往live2d设置页面手动注册</p>
          </div>

          {/* Tabs */}
          <div className="tabs">
            <button
              className={`tab ${activeTab === "subscriptions" ? "active" : ""}`}
              onClick={() => setActiveTab("subscriptions")}
            >
              订阅内容
            </button>
            <button
              className={`tab ${activeTab === "character-cards" ? "active" : ""}`}
              onClick={() => setActiveTab("character-cards")}
            >
              角色卡
            </button>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {/* Filters */}
            <div className="filter-controls">
              <div className="filter-group">
                <label>搜索：</label>
                <input
                  type="text"
                  placeholder="搜索物品..."
                  value={searchTerm}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="filter-group">
                <label>排序：</label>
                <select
                  value={sortBy}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setSortBy(e.target.value as SortOption)}
                >
                  <option value="name_asc">名称（升序）</option>
                  <option value="name_desc">名称（降序）</option>
                  <option value="date_asc">订阅日期（升序）</option>
                  <option value="date_desc">订阅日期（降序）</option>
                  <option value="size_asc">文件大小（升序）</option>
                  <option value="size_desc">文件大小（降序）</option>
                </select>
              </div>

              <button className="refresh-button" onClick={loadItems}>
                🔄 刷新订阅内容
              </button>
            </div>

            {/* Items List */}
            {loading ? (
              <div className="loading-state">
                <p>加载中...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="empty-state">
                <p>暂无订阅内容</p>
              </div>
            ) : (
              <div className="items-grid">
                {filteredItems.map((item) => (
                  <div key={item.id} className="item-card">
                    <div className="item-header">
                      <h3 className="item-name">{item.name}</h3>
                      <span className={`item-type ${item.type}`}>
                        {item.type === "model" ? "🎨 模型" : "🎵 声音"}
                      </span>
                    </div>

                    <div className="item-meta">
                      <div className="meta-row">
                        <span className="label">作者:</span>
                        <span className="value">{item.author}</span>
                      </div>
                      <div className="meta-row">
                        <span className="label">大小:</span>
                        <span className="value">{item.fileSize}</span>
                      </div>
                      <div className="meta-row">
                        <span className="label">更新:</span>
                        <span className="value">{item.lastUpdated}</span>
                      </div>
                    </div>

                    <div className="item-status">
                      {item.downloaded ? (
                        <span className="status-badge downloaded">✅ 已下载</span>
                      ) : (
                        <span className="status-badge pending">⏳ 待下载</span>
                      )}
                    </div>

                    <div className="item-actions">
                      {!item.downloaded && (
                        <button
                          className="action-button download"
                          onClick={() => handleDownload(item.id)}
                        >
                          ⬇️ 下载
                        </button>
                      )}
                      <button
                        className="action-button unsubscribe"
                        onClick={() => handleUnsubscribe(item.id)}
                      >
                        🗑️ 取消订阅
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
