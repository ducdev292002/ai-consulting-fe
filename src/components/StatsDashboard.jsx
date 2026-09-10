import { useEffect, useState } from "react";
import { api } from "../api";

const STAGE_LABELS = {
  discovery: "Khám phá nhu cầu",
  advising: "Đang tư vấn",
  objection: "Đang xử lý phản đối",
  closing: "Đang chốt đơn",
  won: "Đã chốt đơn",
  lost: "Đã từ chối",
};

const STAGE_ORDER = ["discovery", "advising", "objection", "closing", "won", "lost"];

const money = (n) => (typeof n === "number" ? n.toLocaleString("vi-VN") + "đ" : "—");

const dayLabel = (isoDate) => {
  const [, m, d] = isoDate.split("-");
  return `${d}/${m}`;
};

export default function StatsDashboard({ company }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = () => {
    if (!company) return;
    setLoading(true);
    setError("");
    api
      .getStats(company._id)
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?._id]);

  if (loading && !stats) return <p className="empty">Đang tải thống kê...</p>;
  if (error) return <div className="chat-error">{error}</div>;
  if (!stats) return null;

  const { leadFunnel, totalLeads, orders, conversations } = stats;
  const maxFunnelCount = Math.max(1, ...STAGE_ORDER.map((s) => leadFunnel[s] || 0));
  const maxDailyCount = Math.max(1, ...conversations.dailyNewConversations.map((d) => d.count));
  const totalConvModes = conversations.conversationsByMode.ai + conversations.conversationsByMode.human;

  return (
    <div className="stats-dashboard">
      <div className="stats-head">
        <h3>Thống kê tổng quan</h3>
        <button type="button" className="btn-secondary btn-tiny" onClick={refresh} disabled={loading}>
          {loading ? "Đang tải..." : "Làm mới"}
        </button>
      </div>

      <div className="stats-cards">
        <div className="stats-card stats-card--blue">
          <div className="stats-card-icon">💬</div>
          <div className="stats-card-value">{conversations.totalConversations}</div>
          <div className="stats-card-label">Hội thoại</div>
        </div>
        <div className="stats-card stats-card--purple">
          <div className="stats-card-icon">✉️</div>
          <div className="stats-card-value">{conversations.totalMessages}</div>
          <div className="stats-card-label">Tin nhắn</div>
        </div>
        <div className="stats-card stats-card--orange">
          <div className="stats-card-icon">📦</div>
          <div className="stats-card-value">{orders.totalOrders}</div>
          <div className="stats-card-label">Đơn hàng</div>
        </div>
        <div className="stats-card stats-card--green">
          <div className="stats-card-icon">💰</div>
          <div className="stats-card-value">{money(orders.totalRevenue)}</div>
          <div className="stats-card-label">Doanh thu (nháp)</div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="side-box">
          <h4>Phễu bán hàng theo giai đoạn</h4>
          <p className="stats-box-meta">{totalLeads} khách</p>
          {totalLeads === 0 && <p className="empty">Chưa có khách nào.</p>}
          {STAGE_ORDER.map((stage) => {
            const count = leadFunnel[stage] || 0;
            return (
              <div key={stage} className="stats-bar-row">
                <span className="stats-bar-label">{STAGE_LABELS[stage]}</span>
                <div className="stats-bar-track">
                  <div
                    className={`stats-bar-fill stage-${stage}`}
                    style={{ width: `${(count / maxFunnelCount) * 100}%` }}
                  />
                </div>
                <span className="stats-bar-count">{count}</span>
              </div>
            );
          })}
        </div>

        <div className="side-box">
          <h4>AI vs Nhân viên xử lý</h4>
          {totalConvModes === 0 && <p className="empty">Chưa có hội thoại nào.</p>}
          {totalConvModes > 0 && (
            <>
              <div className="stats-bar-row">
                <span className="stats-bar-label">🤖 AI tự xử lý</span>
                <div className="stats-bar-track">
                  <div
                    className="stats-bar-fill mode-ai"
                    style={{ width: `${(conversations.conversationsByMode.ai / totalConvModes) * 100}%` }}
                  />
                </div>
                <span className="stats-bar-count">{conversations.conversationsByMode.ai}</span>
              </div>
              <div className="stats-bar-row">
                <span className="stats-bar-label">🧑‍💼 Nhân viên xử lý</span>
                <div className="stats-bar-track">
                  <div
                    className="stats-bar-fill mode-human"
                    style={{ width: `${(conversations.conversationsByMode.human / totalConvModes) * 100}%` }}
                  />
                </div>
                <span className="stats-bar-count">{conversations.conversationsByMode.human}</span>
              </div>
              <p className="meta">
                Tin nhắn: {conversations.messagesByRole.user} của khách · {conversations.messagesByRole.assistant} của
                AI · {conversations.messagesByRole.staff} của nhân viên
              </p>
            </>
          )}
        </div>

        <div className="side-box">
          <h4>Sản phẩm bán chạy</h4>
          <p className="stats-box-meta">Theo đơn nháp</p>
          {orders.topProducts.length === 0 && <p className="empty">Chưa có đơn hàng nào.</p>}
          {orders.topProducts.length > 0 && (
            <table className="slot-table">
              <tbody>
                {orders.topProducts.map((p) => (
                  <tr key={p.name} className="filled">
                    <td>{p.name}</td>
                    <td>
                      {p.qty} sp · {money(p.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="meta">
            Đơn nháp: {orders.ordersByStatus.draft} · Đã xác nhận: {orders.ordersByStatus.confirmed}
          </p>
        </div>

        <div className="side-box stats-chart-box">
          <h4>Hội thoại mới theo ngày</h4>
          <p className="stats-box-meta">14 ngày gần nhất</p>
          <div className="stats-daily-chart">
            {conversations.dailyNewConversations.map((d) => (
              <div className="stats-daily-bar" key={d.date} title={`${d.date}: ${d.count} hội thoại`}>
                <div
                  className="stats-daily-bar-fill"
                  style={{ height: `${Math.max(4, (d.count / maxDailyCount) * 100)}%` }}
                />
                <span className="stats-daily-bar-label">{dayLabel(d.date)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
