import { useEffect, useState } from "react";
import { api } from "../api";

const money = (n) => (typeof n === "number" ? n.toLocaleString("vi-VN") + "đ" : "—");

const STAGE_LABELS = {
  discovery: "Khám phá nhu cầu",
  advising: "Đang tư vấn",
  objection: "Đang xử lý phản đối",
  closing: "Đang chốt đơn",
  won: "Đã chốt đơn",
  lost: "Đã từ chối",
};

export default function OrdersPanel({ company }) {
  const [orders, setOrders] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([api.listOrders(company._id), api.listLeads(company._id)])
      .then(([o, l]) => {
        setOrders(o);
        setLeads(l);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [company._id]);

  const confirm = async (id) => {
    try {
      const updated = await api.updateOrder(id, { status: "confirmed" });
      setOrders((list) => list.map((o) => (o._id === id ? updated : o)));
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    try {
      await api.deleteOrder(id);
      setOrders((list) => list.filter((o) => o._id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <p className="empty">Đang tải...</p>;

  return (
    <div className="orders-layout">
      {error && <div className="chat-error">{error}</div>}

      <section>
        <h3>Đơn hàng AI đã tạo ({orders.length})</h3>
        {orders.length === 0 && <p className="empty">Chưa có đơn nào. Hãy chat và chốt thử ở tab Demo tư vấn.</p>}
        {orders.map((o) => (
          <div className="card" key={o._id}>
            <div className="card-header">
              <div>
                <strong>{o.customerKey}</strong>
                <span className={`tag ${o.status === "confirmed" ? "ok" : ""}`}>{o.status}</span>
              </div>
              <div className="card-actions">
                {o.status === "draft" && (
                  <button type="button" className="btn-primary" onClick={() => confirm(o._id)}>
                    Xác nhận đơn
                  </button>
                )}
                <button type="button" className="danger" onClick={() => remove(o._id)}>
                  Xoá
                </button>
              </div>
            </div>
            {o.items.map((item, i) => (
              <div key={i} className="order-line">
                <span>
                  {item.name} × {item.qty}
                </span>
                <strong>{money(item.price * item.qty)}</strong>
              </div>
            ))}
            <div className="order-line total">
              <span>Tổng</span>
              <strong>{money(o.total)}</strong>
            </div>
            {o.deliveryArea && <p className="meta">Giao: {o.deliveryArea}</p>}
            {o.note && <p className="meta">Ghi chú: {o.note}</p>}
          </div>
        ))}
      </section>

      <section>
        <h3>Phiếu khách hàng ({leads.length})</h3>
        {leads.length === 0 && <p className="empty">Chưa có phiếu khách nào.</p>}
        {leads.map((l) => (
          <div className="card" key={l._id}>
            <div className="card-header">
              <div>
                <strong>{l.customerKey}</strong>
                <span className="tag">{STAGE_LABELS[l.stage] || l.stage}</span>
              </div>
            </div>
            <p className="meta">
              {[
                l.needType && `Nhu cầu: ${l.needType}`,
                l.budget && `Ngân sách: ${l.budget}`,
                l.spaceInfo && `Không gian: ${l.spaceInfo}`,
                l.concerns?.length && `Lo ngại: ${l.concerns.join(", ")}`,
                l.phone && `SĐT: ${l.phone}`,
                l.area && `Khu vực: ${l.area}`,
              ]
                .filter(Boolean)
                .join(" · ") || "Chưa có thông tin"}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
