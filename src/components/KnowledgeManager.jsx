import { useEffect, useState } from "react";
import { api } from "../api";
import Modal from "./Modal";

const SOURCES = [
  { value: "company", label: "Thông tin công ty" },
  { value: "policy", label: "Chính sách / Quy trình" },
  { value: "industry", label: "Kiến thức ngành" },
  { value: "product", label: "Tài liệu sản phẩm" },
  { value: "web", label: "Lấy từ web" },
];

const sourceLabel = (v) => SOURCES.find((s) => s.value === v)?.label || v;

const empty = { title: "", source: "company", content: "", productId: "" };

const FILTER_ALL = "all";
const FILTER_GENERAL = "general";
const CATEGORY_ALL = "all";
const PAGE_SIZE = 6;

let proposalKeySeq = 0;
const nextKey = () => proposalKeySeq++;

export default function KnowledgeManager({ company, docs, setDocs, products, filterProductId, onClearFilter }) {
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [url, setUrl] = useState("");
  const [uploadProductId, setUploadProductId] = useState("");
  const [crawlUrl, setCrawlUrl] = useState("");
  const [crawlMaxPages, setCrawlMaxPages] = useState(15);
  const [viewingDoc, setViewingDoc] = useState(null);

  const [productFilter, setProductFilter] = useState(FILTER_ALL);
  const [categoryFilter, setCategoryFilter] = useState(CATEGORY_ALL);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Đề xuất chờ duyệt (từ upload file / lấy URL / quét website) — CHƯA lưu vào hệ thống
  const [proposals, setProposals] = useState([]);
  const [proposalMeta, setProposalMeta] = useState(null); // { totalDiscovered, pagesFetched, errors } khi crawl
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState("");

  useEffect(() => {
    if (filterProductId) {
      setProductFilter(filterProductId);
      setUploadProductId(filterProductId);
      setPage(1);
    }
  }, [filterProductId]);

  const resetForm = () => {
    setForm(empty);
    setEditingId(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        const result = await api.updateKnowledge(editingId, form);
        setDocs((list) => list.map((d) => (d._id === editingId ? result.doc : d)));
      } else {
        const result = await api.createKnowledge({
          ...form,
          companyId: company._id,
          productId: form.productId || null,
        });
        setDocs((list) => [...list, result.doc]);
      }
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addProposals = (items) => {
    setProposals((list) => [...list, ...items.map((p) => ({ ...p, key: nextKey(), selected: p.useful }))]);
  };

  const handleUpload = async (file) => {
    setBusy("upload");
    setError("");
    setImportNotice("");
    try {
      const result = await api.uploadKnowledge(file, {
        companyId: company._id,
        productId: uploadProductId || undefined,
      });
      addProposals([{ ...result.proposal, productId: uploadProductId || null }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  const handleFromUrl = async () => {
    if (!url.trim()) return;
    setBusy("url");
    setError("");
    setImportNotice("");
    try {
      const result = await api.knowledgeFromUrl({
        companyId: company._id,
        url: url.trim(),
        productId: uploadProductId || undefined,
      });
      addProposals([{ ...result.proposal, productId: uploadProductId || null }]);
      setUrl("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  const handleCrawl = async () => {
    if (!crawlUrl.trim()) return;
    setBusy("crawl");
    setError("");
    setImportNotice("");
    try {
      const result = await api.crawlKnowledge({
        companyId: company._id,
        startUrl: crawlUrl.trim(),
        maxPages: crawlMaxPages,
      });
      setProposalMeta({
        totalDiscovered: result.totalDiscovered,
        pagesFetched: result.pagesFetched,
        errors: result.errors,
      });
      addProposals(result.proposals);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  const updateProposal = (key, field, value) => {
    setProposals((list) => list.map((p) => (p.key === key ? { ...p, [field]: value } : p)));
  };

  const toggleProposal = (key) => {
    setProposals((list) => list.map((p) => (p.key === key ? { ...p, selected: !p.selected } : p)));
  };

  const discardProposals = () => {
    setProposals([]);
    setProposalMeta(null);
  };

  const importSelected = async () => {
    const toImport = proposals.filter((p) => p.selected);
    if (toImport.length === 0) return;
    setImporting(true);
    setError("");
    try {
      const savedDocs = [];
      for (const p of toImport) {
        if (p.existingDocId) {
          const result = await api.updateKnowledge(p.existingDocId, {
            title: p.title,
            source: p.category,
            content: p.content,
          });
          savedDocs.push(result.doc);
        } else {
          const result = await api.createKnowledge({
            companyId: company._id,
            productId: p.productId || null,
            title: p.title,
            source: p.category,
            content: p.content,
            sourceUrl: p.url || "",
          });
          savedDocs.push(result.doc);
        }
      }
      const savedIds = new Set(savedDocs.map((d) => d._id));
      setDocs((list) => [...list.filter((d) => !savedIds.has(d._id)), ...savedDocs]);
      setProposals((list) => list.filter((p) => !p.selected));
      setImportNotice(`Đã lưu ${savedDocs.length} mục vào hệ thống tri thức.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const reindex = async (id) => {
    setBusy(id);
    setError("");
    try {
      const result = await api.reindexKnowledge(id);
      setDocs((list) => list.map((d) => (d._id === id ? result.doc : d)));
      setImportNotice(`Đã index lại: ${result.chunkCount} đoạn.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  const edit = (doc) => {
    setEditingId(doc._id);
    setForm({ title: doc.title, source: doc.source, content: doc.content, productId: doc.productId || "" });
  };

  const remove = async (id) => {
    try {
      await api.deleteKnowledge(id);
      setDocs((list) => list.filter((d) => d._id !== id));
      if (editingId === id) resetForm();
    } catch (err) {
      setError(err.message);
    }
  };

  const productName = (id) => products.find((p) => p._id === id)?.name;

  const filteredDocs = docs.filter((d) => {
    if (productFilter === FILTER_GENERAL && d.productId) return false;
    if (productFilter !== FILTER_ALL && productFilter !== FILTER_GENERAL && d.productId !== productFilter) {
      return false;
    }
    if (categoryFilter !== CATEGORY_ALL && d.source !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!d.title.toLowerCase().includes(q) && !d.content.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredDocs.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedDocs = filteredDocs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const changeProductFilter = (value) => {
    setProductFilter(value);
    setPage(1);
    onClearFilter?.();
  };

  const changeCategoryFilter = (value) => {
    setCategoryFilter(value);
    setPage(1);
  };

  const changeSearch = (value) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <>
      {proposals.length > 0 && (
        <div className="extract-review">
          <div className="extract-review-head">
            <h3>
              Tri thức đề xuất ({proposals.length}
              {proposalMeta ? ` / quét ${proposalMeta.pagesFetched} trang, tìm ${proposalMeta.totalDiscovered} link` : ""}
              ) — chọn và sửa trước khi lưu
            </h3>
            <div className="form-actions">
              <button type="button" className="btn-primary" onClick={importSelected} disabled={importing}>
                {importing ? "Đang lưu..." : `Lưu ${proposals.filter((p) => p.selected).length} mục đã chọn`}
              </button>
              <button type="button" onClick={discardProposals}>
                Huỷ tất cả
              </button>
            </div>
          </div>

          {proposalMeta?.errors?.length > 0 && (
            <ul className="crawl-errors">
              {proposalMeta.errors.slice(0, 5).map((e, i) => (
                <li key={i}>
                  {e.url}: {e.error}
                </li>
              ))}
            </ul>
          )}

          {proposals.map((p) => (
            <div className={`card proposal-card ${p.selected ? "" : "proposal-unchecked"}`} key={p.key}>
              <div className="card-header">
                <label className="proposal-checkbox">
                  <input type="checkbox" checked={p.selected} onChange={() => toggleProposal(p.key)} />
                  <input
                    className="proposal-name-input"
                    value={p.title}
                    onChange={(e) => updateProposal(p.key, "title", e.target.value)}
                  />
                </label>
                <select value={p.category} onChange={(e) => updateProposal(p.key, "category", e.target.value)}>
                  {SOURCES.filter((s) => s.value !== "product" || p.productId).map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              {p.url && (
                <p className="meta">
                  {p.url}
                  {p.existingDocId && " · sẽ CẬP NHẬT tài liệu đã có (không tạo trùng)"}
                </p>
              )}
              {!p.useful && <p className="fit bad">AI đề xuất bỏ qua: {p.skipReason}</p>}
              <textarea
                rows={4}
                value={p.content}
                onChange={(e) => updateProposal(p.key, "content", e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      {importNotice && <p className="upload-ok">{importNotice}</p>}

      <div className="manager-layout">
        <div className="manager-form-column">
          <div className="manager-form upload-box">
            <h3>Nạp tri thức từ nguồn ngoài</h3>
            <p className="hint">
              AI tự lọc bỏ menu/quảng cáo/thông tin không liên quan, đề xuất tiêu đề + phân loại — bạn xem
              lại trước khi lưu thật.
            </p>
            <label>
              Gắn với sản phẩm <span className="hint">(để trống = tri thức chung)</span>
              <select value={uploadProductId} onChange={(e) => setUploadProductId(e.target.value)}>
                <option value="">-- Tri thức chung, không gắn sản phẩm --</option>
                {products.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <input
              type="file"
              accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md"
              disabled={busy === "upload"}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) handleUpload(file);
              }}
            />
            <label>
              Hoặc lấy nội dung từ URL
              <input
                type="url"
                value={url}
                placeholder="https://savisofa.vn/gioi-thieu"
                onChange={(e) => setUrl(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn-primary"
              onClick={handleFromUrl}
              disabled={busy === "url" || !url.trim()}
            >
              {busy === "url" ? "Đang tải + lọc..." : "Lấy nội dung từ URL"}
            </button>
            {busy === "upload" && <p className="empty">Đang trích xuất + lọc nội dung bằng AI...</p>}
          </div>

          <div className="manager-form upload-box crawl-box">
            <h3>Quét cả website</h3>
            <p className="hint">
              Trang chỉ có form liên hệ, danh sách rỗng, tin tuyển dụng... sẽ tự bị AI loại, không lưu
              tràn lan.
            </p>
            <label>
              URL bắt đầu quét
              <input
                type="url"
                value={crawlUrl}
                placeholder="https://savisofa.vn"
                disabled={busy === "crawl"}
                onChange={(e) => setCrawlUrl(e.target.value)}
              />
            </label>
            <label>
              Số trang tối đa
              <input
                type="number"
                min={1}
                max={30}
                value={crawlMaxPages}
                disabled={busy === "crawl"}
                onChange={(e) => setCrawlMaxPages(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn-primary"
              onClick={handleCrawl}
              disabled={busy === "crawl" || !crawlUrl.trim()}
            >
              {busy === "crawl" ? "Đang quét + lọc..." : "Bắt đầu quét"}
            </button>
            {busy === "crawl" && (
              <p className="empty">Đang tải + lọc từng trang bằng AI, có thể mất vài phút...</p>
            )}
          </div>

          <form className="manager-form" onSubmit={submit}>
            <h3>{editingId ? "Sửa tri thức" : "Thêm tri thức thủ công"}</h3>
            <label>
              Tiêu đề
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
            </label>
            <label>
              Loại
              <select value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}>
                {SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Gắn với sản phẩm <span className="hint">(tuỳ chọn)</span>
              <select
                value={form.productId}
                onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
              >
                <option value="">-- Tri thức chung --</option>
                {products.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nội dung
              <textarea
                rows={6}
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                required
              />
            </label>
            {error && <p className="chat-error">{error}</p>}
            <div className="form-actions">
              <button type="submit" disabled={saving}>
                {editingId ? "Cập nhật" : "Thêm mới"}
              </button>
              {editingId && (
                <button type="button" onClick={resetForm}>
                  Huỷ
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="manager-list">
          <div className="knowledge-filter-bar">
            <input
              type="text"
              className="knowledge-search"
              placeholder="Tìm theo tiêu đề hoặc nội dung..."
              value={search}
              onChange={(e) => changeSearch(e.target.value)}
            />
            <select value={categoryFilter} onChange={(e) => changeCategoryFilter(e.target.value)}>
              <option value={CATEGORY_ALL}>Mọi loại</option>
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label} ({docs.filter((d) => d.source === s.value).length})
                </option>
              ))}
            </select>
            <select value={productFilter} onChange={(e) => changeProductFilter(e.target.value)}>
              <option value={FILTER_ALL}>Mọi sản phẩm ({docs.length})</option>
              <option value={FILTER_GENERAL}>
                Chỉ tri thức chung ({docs.filter((d) => !d.productId).length})
              </option>
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  SP: {p.name} ({docs.filter((d) => d.productId === p._id).length})
                </option>
              ))}
            </select>
          </div>

          <p className="knowledge-result-count">
            {filteredDocs.length} kết quả
            {(search || categoryFilter !== CATEGORY_ALL || productFilter !== FILTER_ALL) && " (đã lọc)"}
          </p>

          {pagedDocs.length === 0 && <p className="empty">Không có tài liệu nào phù hợp bộ lọc.</p>}
          {pagedDocs.map((d) => (
            <div className="card card-clickable" key={d._id}>
              <div className="card-header">
                <div className="card-clickable-area" onClick={() => setViewingDoc(d)}>
                  <strong>{d.title}</strong>
                  <span className="tag">{sourceLabel(d.source)}</span>
                  {d.productId && (
                    <span className="tag product-tag">{productName(d.productId) || "Sản phẩm"}</span>
                  )}
                </div>
                <div className="card-actions">
                  <button type="button" onClick={() => reindex(d._id)} disabled={busy === d._id}>
                    {busy === d._id ? "..." : "Index lại"}
                  </button>
                  <button type="button" onClick={() => edit(d)}>
                    Sửa
                  </button>
                  <button type="button" className="danger" onClick={() => remove(d._id)}>
                    Xoá
                  </button>
                </div>
              </div>
              <p className="meta">
                {d.chunkCount || 0} đoạn đã index
                {d.sourceUrl && (
                  <>
                    {" · "}
                    <a href={d.sourceUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                      nguồn
                    </a>
                  </>
                )}
              </p>
              <p className="clamp card-clickable-area" onClick={() => setViewingDoc(d)}>
                {d.content}
              </p>
            </div>
          ))}

          {totalPages > 1 && (
            <div className="pagination">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                ← Trước
              </button>
              <span className="pagination-info">
                Trang {currentPage}/{totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Sau →
              </button>
            </div>
          )}
        </div>
      </div>

      {viewingDoc && (
        <Modal
          title={viewingDoc.title}
          subtitle={`${sourceLabel(viewingDoc.source)}${
            viewingDoc.productId ? ` · SP: ${productName(viewingDoc.productId) || "?"}` : ""
          } · ${viewingDoc.chunkCount || 0} đoạn đã index${
            viewingDoc.sourceUrl ? ` · ${viewingDoc.sourceUrl}` : ""
          }`}
          onClose={() => setViewingDoc(null)}
          actions={
            <>
              <button
                type="button"
                onClick={() => {
                  edit(viewingDoc);
                  setViewingDoc(null);
                }}
              >
                Sửa
              </button>
              <button type="button" onClick={() => setViewingDoc(null)}>
                Đóng
              </button>
            </>
          }
        >
          <p className="modal-content-text">{viewingDoc.content}</p>
        </Modal>
      )}
    </>
  );
}
