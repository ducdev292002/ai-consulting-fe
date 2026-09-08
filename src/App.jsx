import { useEffect, useState } from "react";
import ChatDemo from "./components/ChatDemo";
import ProductManager from "./components/ProductManager";
import KnowledgeManager from "./components/KnowledgeManager";
import CompetitorManager from "./components/CompetitorManager";
import ScriptManager from "./components/ScriptManager";
import CompanyManager from "./components/CompanyManager";
import OrdersPanel from "./components/OrdersPanel";
import { api } from "./api";
import "./App.css";

const TABS = [
  { id: "chat", label: "Demo tư vấn" },
  { id: "knowledge", label: "Hệ thống tri thức" },
  { id: "orders", label: "Đơn hàng & Khách" },
  { id: "companies", label: "Công ty" },
];

const KNOWLEDGE_SECTIONS = [
  { id: "products", label: "Sản phẩm & tài liệu" },
  { id: "general", label: "Tri thức chung" },
  { id: "competitors", label: "Giá đối thủ" },
  { id: "scripts", label: "Kịch bản" },
];

export default function App() {
  const [tab, setTab] = useState("chat");
  const [section, setSection] = useState("products");

  const [companies, setCompanies] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [products, setProducts] = useState([]);
  const [docs, setDocs] = useState([]);
  const [competitors, setCompetitors] = useState([]);
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
      setCompetitors([]);
      setScripts([]);
      return;
    }
    setLoadError("");
    Promise.all([
      api.listProducts(selectedId),
      api.listKnowledge(selectedId),
      api.listCompetitors(selectedId),
      api.listScripts(selectedId),
    ])
      .then(([p, k, c, s]) => {
        setProducts(p);
        setDocs(k);
        setCompetitors(c);
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

      <nav className="tab-bar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <main className="tab-content">
        {loading && <p className="empty">Đang tải dữ liệu từ server...</p>}
        {loadError && (
          <div className="chat-error">
            Lỗi: {loadError}. Kiểm tra backend đã chạy tại đúng VITE_API_URL chưa.
          </div>
        )}

        {!loading && (
          <>
            {tab === "companies" && (
              <CompanyManager
                companies={companies}
                setCompanies={setCompanies}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
              />
            )}

            {tab !== "companies" && !company && (
              <p className="empty">
                Chưa chọn công ty. Chọn ở góc trên phải, hoặc tạo mới ở tab "Công ty".
              </p>
            )}

            {tab === "chat" && company && <ChatDemo company={company} />}
            {tab === "orders" && company && <OrdersPanel company={company} />}

            {tab === "knowledge" && company && (
              <div>
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

                {section === "products" && (
                  <ProductManager company={company} products={products} setProducts={setProducts} />
                )}
                {section === "general" && (
                  <KnowledgeManager company={company} docs={docs} setDocs={setDocs} />
                )}
                {section === "competitors" && (
                  <CompetitorManager
                    company={company}
                    competitors={competitors}
                    setCompetitors={setCompetitors}
                    products={products}
                  />
                )}
                {section === "scripts" && (
                  <ScriptManager company={company} scripts={scripts} setScripts={setScripts} />
                )}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>
          Mỗi công ty có tri thức riêng biệt. AI trả lời bằng cách gọi tool (tìm sản phẩm, đọc tài liệu
          sản phẩm, so sánh giá đối thủ, tra tri thức qua embedding, tìm kiếm web) — không nhồi toàn bộ
          dữ liệu vào prompt. OPENAI_API_KEY chỉ nằm trong .env của server.
        </p>
      </footer>
    </div>
  );
}
