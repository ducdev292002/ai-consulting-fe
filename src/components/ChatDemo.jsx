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
  shareProductImage: "Gửi ảnh sản phẩm",
  searchCompanyKnowledge: "Tra tri thức công ty",
  updateLead: "Cập nhật phiếu khách",
  createOrder: "Tạo đơn nháp",
  web_search: "Tìm kiếm web",
};

const money = (n) => (typeof n === "number" ? n.toLocaleString("vi-VN") + "đ" : "—");

const initials = (text) =>
  (text || "?")
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const timeFmt = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit",
});

const formatTime = (iso) => {
  if (!iso) return "";
  try {
    return timeFmt.format(new Date(iso));
  } catch {
    return "";
  }
};

export default function ChatDemo({ company }) {
  const [conversations, setConversations] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [customerKey, setCustomerKey] = useState("");
  const [newKeyDraft, setNewKeyDraft] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lead, setLead] = useState(null);
  const [order, setOrder] = useState(null);
  const [toolCalls, setToolCalls] = useState([]);
  const [mode, setMode] = useState("ai");
  // Vai đang gõ tin trong ô nhập — độc lập với "mode" (ai/nhân viên đang xử lý hội thoại):
  // "customer" để test/mô phỏng tin khách gửi tới (đi qua /chat, AI trả lời nếu mode=ai, chỉ
  // ghi nhận nếu mode=human), "staff" để trả lời trực tiếp thay nhân viên (chỉ dùng khi mode=human).
  const [sendAs, setSendAs] = useState("customer");
  const [staffName, setStaffName] = useState("");
  const [scripts, setScripts] = useState([]);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  // Gợi ý câu trả lời do AI soạn sẵn mỗi khi khách nhắn đến lúc nhân viên đang xử lý — nhân viên
  // xem, có thể dùng luôn hoặc chỉnh sửa trước khi gửi, AI không tự gửi thay.
  const [suggestion, setSuggestion] = useState("");
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const refreshList = async () => {
    if (!company) return;
    setLoadingList(true);
    try {
      const list = await api.listConversations(company._id);
      setConversations(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    setCustomerKey("");
    setMessages([]);
    setLead(null);
    setOrder(null);
    setToolCalls([]);
    setMode("ai");
    setSendAs("customer");
    setSummary("");
    setSuggestion("");
    setShowNewChat(false);
    refreshList();
    if (company) {
      api.listScripts(company._id).then(setScripts).catch(() => setScripts([]));
    } else {
      setScripts([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?._id]);

  const stageScripts = lead?.stage ? scripts.filter((s) => s.stage === lead.stage) : [];

  const openConversation = async (key) => {
    if (!key.trim() || !company) return;
    const trimmed = key.trim();
    setCustomerKey(trimmed);
    setShowNewChat(false);
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
          images: m.images || [],
          createdAt: m.createdAt,
        }))
      );
      setLead(currentLead);
      setOrder(orders?.[0] || null);
      setToolCalls([]);
      const openedMode = conversation.mode || "ai";
      setMode(openedMode);
      setSendAs(openedMode === "human" ? "staff" : "customer");
      setSummary(conversation.summary || "");

      const convoMessages = conversation.messages || [];
      const lastMsg = convoMessages[convoMessages.length - 1];
      if (openedMode === "human" && lastMsg?.role === "user") {
        // Gợi ý đã có sẵn (cache) từ chính hội thoại này và chưa "cũ" (không có tin nhắn mới hơn)
        // — dùng luôn, khỏi gọi lại API/AI chỉ vì mở lại hội thoại.
        if (conversation.suggestion && conversation.suggestionMessageCount === convoMessages.length) {
          setSuggestion(conversation.suggestion);
        } else {
          fetchSuggestion(trimmed);
        }
      } else {
        setSuggestion("");
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchSummary = async (force = false) => {
    const key = customerKey.trim();
    if (!key || summaryLoading) return;
    setSummaryLoading(true);
    setError("");
    try {
      const result = await api.summarizeConversation(company._id, key, force);
      setSummary(result.summary);
    } catch (err) {
      setError(err.message);
    } finally {
      setSummaryLoading(false);
    }
  };

  const fetchSuggestion = async (key, force = false) => {
    if (!key || !company) return;
    setSuggestionLoading(true);
    try {
      const result = await api.suggestReply(company._id, key, force);
      setSuggestion(result.available ? result.suggestion : "");
      if (result.lead) setLead(result.lead);
      if (result.order) setOrder(result.order);
      if (result.toolCalls) setToolCalls(result.toolCalls);
    } catch (err) {
      setError(err.message);
    } finally {
      setSuggestionLoading(false);
    }
  };

  const startNewConversation = () => {
    const key = newKeyDraft.trim();
    if (!key) return;
    setNewKeyDraft("");
    openConversation(key);
  };

  const sendMessage = async () => {
    const text = input.trim();
    const key = customerKey.trim();
    if (!text || loading) return;
    if (!key) {
      setError("Chọn hoặc tạo một cuộc hội thoại trước khi nhắn.");
      return;
    }

    setError("");
    setLoading(true);

    // sendAs "staff": nhân viên đang trả lời trực tiếp cho khách, không qua AI.
    if (sendAs === "staff") {
      setMessages((list) => [
        ...list,
        {
          id: crypto.randomUUID(),
          role: "staff",
          content: text,
          staffName: staffName.trim(),
          createdAt: new Date().toISOString(),
        },
      ]);
      setInput("");
      setSuggestion("");
      try {
        const conversation = await api.sendStaffMessage(company._id, key, text, staffName.trim());
        setMessages(
          (conversation.messages || []).map((m, i) => ({
            id: `${i}-${m.role}`,
            role: m.role,
            content: m.content,
            images: m.images || [],
            staffName: m.staffName || "",
            createdAt: m.createdAt,
          }))
        );
        refreshList();
      } catch (err) {
        setError(err.message || "Có lỗi xảy ra khi gọi máy chủ.");
      } finally {
        setLoading(false);
      }
      return;
    }

    setMessages((list) => [
      ...list,
      { id: crypto.randomUUID(), role: "user", content: text, createdAt: new Date().toISOString() },
    ]);
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
          images: m.images || [],
          createdAt: m.createdAt,
        }))
      );
      setLead(result.lead);
      if (result.order) setOrder(result.order);
      setToolCalls(result.toolCalls || []);
      refreshList();
      // Khách vừa nhắn đến lúc nhân viên đang xử lý (mode=human) — AI không tự trả lời nhưng
      // soạn sẵn 1 gợi ý để nhân viên tham khảo/dùng luôn.
      if (result.aiPaused) fetchSuggestion(key);
      else setSuggestion("");
    } catch (err) {
      setError(err.message || "Có lỗi xảy ra khi gọi máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = async () => {
    const key = customerKey.trim();
    if (!key) return;
    const nextMode = mode === "ai" ? "human" : "ai";
    setError("");
    try {
      await api.setConversationMode(company._id, key, nextMode);
      setMode(nextMode);
      setSendAs(nextMode === "human" ? "staff" : "customer");
      refreshList();
      // Tiếp nhận: tự lấy tóm tắt + gợi ý trả lời ngay (nếu tin cuối là của khách) để nhân viên
      // nắm nhanh bối cảnh và có sẵn gợi ý trước khi trả lời.
      if (nextMode === "human") {
        fetchSummary();
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.role === "user") fetchSuggestion(key);
        else setSuggestion("");
      }
      // Trả lại cho AI: nếu khách có tin nhắn đang "treo" chưa được trả lời (gửi lúc mode=human),
      // để AI xử lý luôn thay vì im lặng chờ khách nhắn thêm.
      if (nextMode === "ai") {
        setSuggestion("");
        setLoading(true);
        try {
          const result = await api.resumeChat(company._id, key);
          if (result.resumed) {
            setMessages(
              (result.messages || []).map((m, i) => ({
                id: `${i}-${m.role}`,
                role: m.role,
                content: m.content,
                images: m.images || [],
                staffName: m.staffName || "",
                createdAt: m.createdAt,
              }))
            );
            setLead(result.lead);
            if (result.order) setOrder(result.order);
            setToolCalls(result.toolCalls || []);
            refreshList();
          }
        } finally {
          setLoading(false);
        }
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteConversation = async (key, e) => {
    e.stopPropagation();
    if (!confirm(`Xoá toàn bộ hội thoại với "${key}"?`)) return;
    try {
      await Promise.all([
        api.clearConversation(company._id, key),
        api.deleteLead(company._id, key),
      ]);
      if (customerKey === key) {
        setCustomerKey("");
        setMessages([]);
        setLead(null);
        setOrder(null);
        setMode("ai");
        setSendAs("customer");
        setSummary("");
        setSuggestion("");
      }
      refreshList();
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
    <div className="chat-layout-3col">
      <div className="conv-list">
        <div className="conv-list-head">
          <strong>Hội thoại</strong>
          <button type="button" className="btn-primary" onClick={() => setShowNewChat((v) => !v)}>
            + Mới
          </button>
        </div>

        {showNewChat && (
          <div className="conv-new-box">
            <input
              type="text"
              autoFocus
              placeholder="SĐT hoặc tên khách mới..."
              value={newKeyDraft}
              onChange={(e) => setNewKeyDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startNewConversation()}
            />
            <button
              type="button"
              className="btn-primary"
              onClick={startNewConversation}
              disabled={!newKeyDraft.trim()}
            >
              Bắt đầu
            </button>
          </div>
        )}

        <div className="conv-items">
          {loadingList && <p className="empty">Đang tải...</p>}
          {!loadingList && conversations.length === 0 && (
            <p className="empty">Chưa có hội thoại nào. Bấm "+ Mới" để bắt đầu.</p>
          )}
          {conversations.map((c) => (
            <div
              key={c.customerKey}
              className={`conv-item ${customerKey === c.customerKey ? "active" : ""}`}
              onClick={() => openConversation(c.customerKey)}
            >
              <div className="conv-avatar">{initials(c.customerKey)}</div>
              <div className="conv-info">
                <div className="conv-top-row">
                  <span className="conv-name">{c.customerKey}</span>
                  <span className="conv-time">{formatTime(c.lastMessageAt)}</span>
                </div>
                <div className="conv-preview">
                  {c.lastMessageRole === "assistant" && "Bot: "}
                  {c.lastMessageRole === "staff" && "NV: "}
                  {c.lastMessage.slice(0, 40)}
                </div>
                <div className="conv-badges">
                  {c.stage && <span className="conv-stage">{STAGE_LABELS[c.stage] || c.stage}</span>}
                  {c.mode === "human" && <span className="conv-mode-badge">Nhân viên</span>}
                </div>
              </div>
              <button type="button" className="conv-delete" onClick={(e) => deleteConversation(c.customerKey, e)}>
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="chat-panel">
        {!customerKey ? (
          <div className="chat-empty-state">
            <p className="empty">Chọn một hội thoại bên trái, hoặc bấm "+ Mới" để bắt đầu chat với khách mới.</p>
          </div>
        ) : (
          <>
            <div className="chat-toolbar">
              <strong>Đang chat với: {customerKey}</strong>
              <div className="mode-toggle">
                <span className={`mode-indicator ${mode}`}>
                  {mode === "human" ? "🧑‍💼 Nhân viên đang xử lý" : "🤖 AI đang tự động trả lời"}
                </span>
                <button type="button" className="btn-secondary" onClick={toggleMode}>
                  {mode === "human" ? "Trả lại cho AI" : "Tiếp nhận (nhân viên)"}
                </button>
              </div>
            </div>

            <div className="chat-messages" ref={scrollRef}>
              {messages.length === 0 && (
                <p className="empty">
                  Đóng vai khách hàng và nhắn thử. VD: "mình muốn mua sofa, nhà có bé 3 tuổi, ngân sách
                  khoảng 15 triệu"
                </p>
              )}
              {messages.map((m, i) => {
                const isLastOfGroup = i === messages.length - 1 || messages[i + 1].role !== m.role;
                return (
                <div key={m.id} className={`bubble-row ${m.role} ${isLastOfGroup ? "" : "grouped"}`}>
                  <div className={`bubble ${m.role}`}>
                    {m.role === "staff" && m.staffName && (
                      <div className="bubble-staff-name">{m.staffName}</div>
                    )}
                    {m.content}
                    {m.images?.length > 0 && (
                      <div className="bubble-images">
                        {m.images.map((img, i) => (
                          <a key={i} href={img.url} target="_blank" rel="noreferrer">
                            <img
                              src={img.url}
                              alt={img.name || ""}
                              className="bubble-image"
                              onError={(e) => (e.target.style.display = "none")}
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  {isLastOfGroup && <span className="bubble-time">{formatTime(m.createdAt)}</span>}
                </div>
                );
              })}
              {loading && <div className="bubble assistant loading">AI đang tra dữ liệu và soạn tin...</div>}
            </div>

            {error && <div className="chat-error">{error}</div>}

            {mode === "human" && sendAs === "staff" && (suggestionLoading || suggestion) && (
              <div className="ai-suggestion-box">
                <div className="ai-suggestion-head">
                  <span>💡 Gợi ý trả lời từ AI</span>
                  <button
                    type="button"
                    className="btn-secondary btn-tiny"
                    onClick={() => fetchSuggestion(customerKey, true)}
                    disabled={suggestionLoading}
                  >
                    Làm mới
                  </button>
                </div>
                {suggestionLoading ? (
                  <p className="empty">Đang soạn gợi ý...</p>
                ) : (
                  <>
                    <p className="ai-suggestion-text">{suggestion}</p>
                    <button type="button" className="btn-primary btn-tiny" onClick={() => setInput(suggestion)}>
                      Dùng gợi ý này
                    </button>
                  </>
                )}
              </div>
            )}

            {mode === "human" && (
              <div className="send-as-toggle">
                <button
                  type="button"
                  className={sendAs === "customer" ? "active" : ""}
                  onClick={() => setSendAs("customer")}
                >
                  Nhắn vai Khách (test)
                </button>
                <button
                  type="button"
                  className={sendAs === "staff" ? "active" : ""}
                  onClick={() => setSendAs("staff")}
                >
                  Trả lời (Nhân viên)
                </button>
              </div>
            )}
            {mode === "human" && sendAs === "staff" && (
              <div className="staff-name-row">
                <input
                  type="text"
                  placeholder="Tên nhân viên (hiển thị trong tin nhắn)..."
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                />
              </div>
            )}
            <div className="chat-input-row">
              <textarea
                rows={2}
                placeholder={
                  sendAs === "staff"
                    ? "Nhập tin nhắn trả lời khách (gửi trực tiếp, không qua AI)..."
                    : "Nhập tin nhắn khách hàng..."
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
              />
              <button type="button" className="btn-primary" onClick={sendMessage} disabled={loading || !input.trim()}>
                Gửi
              </button>
            </div>
          </>
        )}
      </div>

      <div className="chat-side">
        <div className="side-box">
          <div className="side-box-head">
            <h4>Tóm tắt hội thoại</h4>
            <button
              type="button"
              className="btn-secondary btn-tiny"
              onClick={() => fetchSummary(true)}
              disabled={summaryLoading || !customerKey}
            >
              {summaryLoading ? "Đang tóm tắt..." : summary ? "Tóm tắt lại" : "Tóm tắt"}
            </button>
          </div>
          {!summary && !summaryLoading && <p className="empty">Chưa có bản tóm tắt.</p>}
          {summary && <p className="summary-text">{summary}</p>}
        </div>

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
          <h4>Kịch bản gợi ý (giai đoạn hiện tại)</h4>
          {!lead?.stage && <p className="empty">Chưa xác định giai đoạn.</p>}
          {lead?.stage && stageScripts.length === 0 && (
            <p className="empty">Chưa có kịch bản cho giai đoạn "{STAGE_LABELS[lead.stage] || lead.stage}".</p>
          )}
          {stageScripts.map((s) => (
            <div key={s._id} className="script-suggestion">
              <div className="script-suggestion-name">{s.name}</div>
              {s.situation && <div className="script-suggestion-situation">{s.situation}</div>}
              <div className="script-suggestion-content">{s.content}</div>
            </div>
          ))}
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
              {Object.keys(t.args || {}).length > 0 && <code>{JSON.stringify(t.args)}</code>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
