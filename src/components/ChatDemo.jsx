import { useEffect, useRef, useState } from "react";
import { api } from "../api";

const STAGE_LABELS = {
  discovery: "Khám phá nhu cầu",
  advising: "Đang tư vấn",
  objection: "Đang xử lý phản đối",
  closing: "Đang chốt đơn",
  won: "Đã chốt đơn",
  lost: "Đã từ chối",
};

const TOOL_LABELS = {
  searchProducts: "Tìm sản phẩm",
  getProductDetail: "Đọc tài liệu sản phẩm",
  compareWithMarket: "So sánh giá đối thủ",
  searchCompanyKnowledge: "Tra tri thức công ty",
  updateLead: "Cập nhật phiếu khách",
  createOrder: "Tạo đơn nháp",
  web_search: "Tìm kiếm web",
};

const money = (n) => (typeof n === "number" ? n.toLocaleString("vi-VN") + "đ" : "—");

export default function ChatDemo({ company }) {
  const [customerKey, setCustomerKey] = useState("0901234567");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lead, setLead] = useState(null);
  const [order, setOrder] = useState(null);
  const [toolCalls, setToolCalls] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const loadCustomer = async (key) => {
    const trimmed = key.trim();
    if (!trimmed || !company) return;
    setError("");
    try {
      const [conversation, currentLead, orders] = await Promise.all([
        api.getConversation(company._id, trimmed),
        api.getLead(company._id, trimmed),
        api.listOrders(company._id, trimmed),
      ]);
      setMessages(
        (conversation.messages || []).map((m, i) => ({
          id: `${i}-${m.role}`,
          role: m.role,
          content: m.content,
        }))
      );
      setLead(currentLead);
      setOrder(orders?.[0] || null);
      setToolCalls([]);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    setMessages([]);
    setLead(null);
    setOrder(null);
    setToolCalls([]);
  }, [company?._id]);

  const sendMessage = async () => {
    const text = input.trim();
    const key = customerKey.trim();
    if (!text || loading) return;
    if (!key) {
      setError("Cần nhập định danh khách (SĐT hoặc tên) trước khi chat.");
      return;
    }

    setError("");
    setLoading(true);
    setMessages((list) => [...list, { id: crypto.randomUUID(), role: "user", content: text }]);
    setInput("");

    try {
      const result = await api.sendChat({
        companyId: company._id,
        customerKey: key,
        message: text,
      });

      setMessages(
        (result.messages || []).map((m, i) => ({
          id: `${i}-${m.role}`,
          role: m.role,
          content: m.content,
        }))
      );
      setLead(result.lead);
      if (result.order) setOrder(result.order);
      setToolCalls(result.toolCalls || []);
    } catch (err) {
      setError(err.message || "Có lỗi xảy ra khi gọi máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  const clearAll = async () => {
    const key = customerKey.trim();
    setMessages([]);
    setToolCalls([]);
    if (!key) return;
    try {
      await Promise.all([
        api.clearConversation(company._id, key),
        api.deleteLead(company._id, key),
      ]);
      setLead(null);
      setOrder(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const slots = [
    ["Nhu cầu", lead?.needType],
    ["Ngân sách", lead?.budget],
    ["Không gian", lead?.spaceInfo],
    ["Lo ngại", lead?.concerns?.join(", ")],
    ["Số điện thoại", lead?.phone],
    ["Khu vực", lead?.area],
  ];

  return (
    <div className="chat-layout">
      <div className="chat-panel">
        <div className="chat-toolbar">
          <label>
            Định danh khách (SĐT/tên):
            <input
              type="text"
              value={customerKey}
              placeholder="VD: 0901234567"
              onChange={(e) => setCustomerKey(e.target.value)}
              onBlur={(e) => loadCustomer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadCustomer(customerKey)}
            />
          </label>
          <button type="button" onClick={() => loadCustomer(customerKey)}>
            Tải lại khách
          </button>
          <button type="button" className="danger" onClick={clearAll}>
            Xoá hội thoại + phiếu
          </button>
        </div>

        <div className="chat-messages" ref={scrollRef}>
          {messages.length === 0 && (
            <p className="empty">
              Đóng vai khách hàng và nhắn thử. VD: "mình muốn mua sofa, nhà có bé 3 tuổi, ngân sách
              khoảng 15 triệu"
            </p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.role}`}>
              {m.content}
            </div>
          ))}
          {loading && <div className="bubble assistant loading">AI đang tra dữ liệu và soạn tin...</div>}
        </div>

        {error && <div className="chat-error">{error}</div>}

        <div className="chat-input-row">
          <textarea
            rows={2}
            placeholder="Nhập tin nhắn khách hàng..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button type="button" onClick={sendMessage} disabled={loading || !input.trim()}>
            Gửi
          </button>
        </div>
      </div>

      <div className="chat-side">
        <div className="side-box">
          <h4>Phiếu thông tin khách</h4>
          <div className="stage-badge">{STAGE_LABELS[lead?.stage] || "Chưa bắt đầu"}</div>
          <table className="slot-table">
            <tbody>
              {slots.map(([label, value]) => (
                <tr key={label} className={value ? "filled" : "missing"}>
                  <td>{label}</td>
                  <td>{value || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="side-box">
          <h4>Đơn hàng nháp</h4>
          {!order && <p className="empty">Chưa có đơn.</p>}
          {order && (
            <>
              {order.items.map((item, i) => (
                <div key={i} className="order-line">
                  <span>
                    {item.name} × {item.qty}
                  </span>
                  <strong>{money(item.price * item.qty)}</strong>
                </div>
              ))}
              <div className="order-line total">
                <span>Tổng</span>
                <strong>{money(order.total)}</strong>
              </div>
              {order.deliveryArea && <p className="order-meta">Giao: {order.deliveryArea}</p>}
              <p className="order-meta">Trạng thái: {order.status}</p>
            </>
          )}
        </div>

        <div className="side-box">
          <h4>AI vừa gọi tool</h4>
          {toolCalls.length === 0 && <p className="empty">Chưa gọi tool nào.</p>}
          {toolCalls.map((t, i) => (
            <div key={i} className="tool-line">
              <span className="tool-name">{TOOL_LABELS[t.name] || t.name}</span>
              {Object.keys(t.args || {}).length > 0 && (
                <code>{JSON.stringify(t.args)}</code>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
