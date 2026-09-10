import { useEffect, useState } from "react";
import ChatDemo from "./components/ChatDemo";
import ProductManager from "./components/ProductManager";
import KnowledgeManager from "./components/KnowledgeManager";
import ScriptManager from "./components/ScriptManager";
import CompanyManager from "./components/CompanyManager";
import OrdersPanel from "./components/OrdersPanel";
import StatsDashboard from "./components/StatsDashboard";
import { api } from "./api";
import "./App.css";

const TABS = [
  { id: "chat", label: "Demo tư vấn", icon: "💬" },
  { id: "knowledge", label: "Hệ thống tri thức", icon: "📚" },
  { id: "orders", label: "Đơn hàng & Khách", icon: "🧾" },
  { id: "stats", label: "Thống kê", icon: "📊" },
  { id: "companies", label: "Công ty", icon: "🏢" },
];

const KNOWLEDGE_SECTIONS = [
  { id: "products", label: "Sản phẩm" },
  { id: "general", label: "Tài liệu & tri thức" },
  { id: "scripts", label: "Kịch bản" },
];

export default function App() {
  const [tab, setTab] = useState("chat");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [section, setSection] = useState("products");
  const [knowledgeProductFilter, setKnowledgeProductFilter] = useState(null);

  const [companies, setCompanies] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [products, setProducts] = useState([]);
  const [docs, setDocs] = useState([]);
  const [scripts, setScripts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    api
      .listCompanies()
      .then((list) => {
        setCompanies(list);
        if (list.length > 0) setSelectedId(list[0]._id);
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setProducts([]);
      setDocs([]);
      setScripts([]);
      return;
    }
    setLoadError("");
    Promise.all([api.listProducts(selectedId), api.listKnowledge(selectedId), api.listScripts(selectedId)])
      .then(([p, k, s]) => {
        setProducts(p);
        setDocs(k);
        setScripts(s);
      })
      .catch((err) => setLoadError(err.message));
  }, [selectedId]);

  const company = companies.find((c) => c._id === selectedId) || null;

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Tư vấn bán hàng AI — Demo</h1>
        <div className="company-picker">
          <label>
            Công ty đang demo:
            <select value={selectedId || ""} onChange={(e) => setSelectedId(e.target.value || null)}>
              <option value="">-- Chọn công ty --</option>
              {companies.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div className="app-body">
        <nav className={`sidebar-nav ${sidebarCollapsed ? "collapsed" : ""}`}>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed((v) => !v)}
            title={sidebarCollapsed ? "Mở rộng menu" : "Thu gọn menu"}
          >
            {sidebarCollapsed ? "»" : "«"}
          </button>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "active" : ""}
              onClick={() => setTab(t.id)}
              title={t.label}
            >
              <span className="sidebar-icon">{t.icon}</span>
              <span className="sidebar-label">{t.label}</span>
            </button>
          ))}
        </nav>

        {/* Các tab bên dưới KHÔNG unmount khi chuyển qua lại — chỉ ẩn/hiện bằng thuộc tính
            "hidden". Nhờ vậy các tác vụ chạy lâu (quét web, tách kịch bản...) vẫn tiếp tục
            và giữ nguyên kết quả dù bạn chuyển sang tab khác rồi quay lại, thay vì bị mất vì
            component bị huỷ. Đổi công ty vẫn reset đúng nhờ key={company._id}. */}
        <main className="tab-content">
          {loading && <p className="empty">Đang tải dữ liệu từ server...</p>}
          {loadError && (
            <div className="chat-error">
              Lỗi: {loadError}. Kiểm tra backend đã chạy tại đúng VITE_API_URL chưa.
            </div>
          )}

          {!loading && (
            <>
              <div hidden={tab !== "companies"}>
                <CompanyManager
                  companies={companies}
                  setCompanies={setCompanies}
                  selectedId={selectedId}
                  setSelectedId={setSelectedId}
                />
              </div>

              {!company && tab !== "companies" && (
                <p className="empty">
                  Chưa chọn công ty. Chọn ở góc trên phải, hoặc tạo mới ở tab "Công ty".
                </p>
              )}

              {company && (
                <>
                  <div hidden={tab !== "chat"}>
                    <ChatDemo key={company._id} company={company} />
                  </div>

                  <div hidden={tab !== "orders"}>
                    <OrdersPanel key={company._id} company={company} />
                  </div>

                  <div hidden={tab !== "stats"}>
                    <StatsDashboard key={company._id} company={company} />
                  </div>

                  <div hidden={tab !== "knowledge"}>
                    <div className="sub-tab-bar">
                      {KNOWLEDGE_SECTIONS.map((s) => (
                        <button
                          key={s.id}
                          className={section === s.id ? "active" : ""}
                          onClick={() => setSection(s.id)}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>

                    <div hidden={section !== "products"}>
                      <ProductManager
                        key={company._id}
                        company={company}
                        products={products}
                        setProducts={setProducts}
                        docs={docs}
                        onViewDocs={(productId) => {
                          setKnowledgeProductFilter(productId);
                          setSection("general");
                        }}
                      />
                    </div>
                    <div hidden={section !== "general"}>
                      <KnowledgeManager
                        key={company._id}
                        company={company}
                        docs={docs}
                        setDocs={setDocs}
                        products={products}
                        filterProductId={knowledgeProductFilter}
                        onClearFilter={() => setKnowledgeProductFilter(null)}
                      />
                    </div>
                    <div hidden={section !== "scripts"}>
                      <ScriptManager key={company._id} company={company} scripts={scripts} setScripts={setScripts} />
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>

      <footer className="app-footer">
        <p>
          Mỗi công ty có tri thức riêng biệt. AI trả lời bằng cách gọi tool (tìm sản phẩm, đọc tài liệu
          sản phẩm, tra tri thức qua embedding, tìm kiếm web) — không nhồi toàn bộ dữ liệu vào prompt.
          OPENAI_API_KEY chỉ nằm trong .env của server.
        </p>
      </footer>
    </div>
  );
}
