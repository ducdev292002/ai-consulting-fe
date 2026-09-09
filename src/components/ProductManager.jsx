import { useState } from "react";
import { api } from "../api";
import Modal from "./Modal";

const empty = {
  name: "",
  category: "",
  sku: "",
  price: "",
  priceAfterDiscount: "",
  size: "",
  material: "",
  specs: "",
  bestFor: "",
  notFor: "",
  usp: "",
  stock: "",
  imageUrl: "",
  sourceUrl: "",
  description: "",
};

const toList = (text) =>
  text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const money = (n) => (typeof n === "number" && n > 0 ? n.toLocaleString("vi-VN") + "đ" : "—");

const CATEGORY_ALL = "all";
const PAGE_SIZE = 6;

export default function ProductManager({ company, products, setProducts, docs, onViewDocs }) {
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [extractBusy, setExtractBusy] = useState(false);
  const [extractProgress, setExtractProgress] = useState(null); // { done, total } | null
  const [extractError, setExtractError] = useState("");
  const [proposals, setProposals] = useState(null); // null = chưa có đề xuất nào
  const [skipped, setSkipped] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(CATEGORY_ALL);
  const [page, setPage] = useState(1);
  const [viewingProduct, setViewingProduct] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const resetForm = () => {
    setForm(empty);
    setEditingId(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError("");

    const payload = {
      companyId: company._id,
      name: form.name.trim(),
      category: form.category.trim(),
      sku: form.sku.trim(),
      price: Number(form.price) || 0,
      priceAfterDiscount: form.priceAfterDiscount ? Number(form.priceAfterDiscount) : null,
      size: form.size.trim(),
      material: form.material.trim(),
      specs: form.specs.trim(),
      bestFor: toList(form.bestFor),
      notFor: toList(form.notFor),
      usp: toList(form.usp),
      stock: Number(form.stock) || 0,
      imageUrl: form.imageUrl.trim(),
      sourceUrl: form.sourceUrl.trim(),
      description: form.description.trim(),
    };

    try {
      if (editingId) {
        const updated = await api.updateProduct(editingId, payload);
        setProducts((list) => list.map((p) => (p._id === editingId ? updated : p)));
      } else {
        const created = await api.createProduct(payload);
        setProducts((list) => [...list, created]);
      }
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const edit = (p) => {
    setEditingId(p._id);
    setForm({
      name: p.name || "",
      category: p.category || "",
      sku: p.sku || "",
      price: p.price || "",
      priceAfterDiscount: p.priceAfterDiscount || "",
      size: p.size || "",
      material: p.material || "",
      specs: p.specs || "",
      bestFor: (p.bestFor || []).join(", "),
      notFor: (p.notFor || []).join(", "),
      usp: (p.usp || []).join(", "),
      stock: p.stock || "",
      imageUrl: p.imageUrl || "",
      sourceUrl: p.sourceUrl || "",
      description: p.description || "",
    });
  };

  const remove = async (id) => {
    setError("");
    try {
      await api.deleteProduct(id);
      setProducts((list) => list.filter((p) => p._id !== id));
      if (editingId === id) resetForm();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleSelected = (id) => {
    setSelectedIds((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedIds((set) => {
      const allSelected = filteredProducts.every((p) => set.has(p._id));
      if (allSelected) return new Set();
      return new Set(filteredProducts.map((p) => p._id));
    });
  };

  const removeSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Xoá ${selectedIds.size} sản phẩm đã chọn? Không thể hoàn tác.`)) return;
    setBulkDeleting(true);
    setError("");
    try {
      const ids = [...selectedIds];
      await Promise.all(ids.map((id) => api.deleteProduct(id)));
      setProducts((list) => list.filter((p) => !selectedIds.has(p._id)));
      setSelectedIds(new Set());
    } catch (err) {
      setError(err.message);
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleExtractFile = async (file) => {
    setExtractBusy(true);
    setExtractProgress(null);
    setExtractError("");
    setImportNotice("");
    setProposals(null);
    setSkipped([]);
    try {
      const result = await api.extractProducts(file, company._id, (p) => setExtractProgress(p));
      setProposals(
        result.products.map((p) => ({
          ...p,
          bestFor: (p.bestFor || []).join(", "),
          notFor: (p.notFor || []).join(", "),
          usp: (p.usp || []).join(", "),
          selected: true,
        }))
      );
      setSkipped(result.skipped || []);
    } catch (err) {
      setExtractError(err.message);
    } finally {
      setExtractBusy(false);
      setExtractProgress(null);
    }
  };

  const updateProposal = (index, field, value) => {
    setProposals((list) => list.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  const toggleProposal = (index) => {
    setProposals((list) => list.map((p, i) => (i === index ? { ...p, selected: !p.selected } : p)));
  };

  const discardProposals = () => {
    setProposals(null);
    setSkipped([]);
  };

  const importSelected = async () => {
    const toImport = proposals.filter((p) => p.selected);
    if (toImport.length === 0) return;
    setImporting(true);
    setExtractError("");
    try {
      const created = [];
      for (const p of toImport) {
        const saved = await api.createProduct({
          companyId: company._id,
          name: p.name,
          category: p.category,
          sku: p.sku,
          price: Number(p.price) || 0,
          priceAfterDiscount: p.priceAfterDiscount ? Number(p.priceAfterDiscount) : null,
          size: p.size,
          material: p.material,
          specs: p.specs,
          bestFor: toList(p.bestFor),
          notFor: toList(p.notFor),
          usp: toList(p.usp),
          stock: Number(p.stock) || 0,
          imageUrl: p.imageUrl || "",
          sourceUrl: p.sourceUrl || "",
          description: p.description || "",
        });
        created.push(saved);
      }
      setProducts((list) => [...list, ...created]);
      setProposals((list) => list.filter((p) => !p.selected));
      setImportNotice(`Đã lưu ${created.length} sản phẩm.`);
    } catch (err) {
      setExtractError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const docCount = (productId) => docs.filter((d) => d.productId === productId).length;

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];

  const filteredProducts = products.filter((p) => {
    if (categoryFilter !== CATEGORY_ALL && p.category !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !(p.sku || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedProducts = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const changeSearch = (v) => {
    setSearch(v);
    setPage(1);
  };
  const changeCategoryFilter = (v) => {
    setCategoryFilter(v);
    setPage(1);
  };

  return (
    <>
      {proposals && (
        <div className="extract-review">
          <div className="extract-review-head">
            <h3>Sản phẩm đề xuất ({proposals.length}) — chọn và sửa trước khi lưu</h3>
            <div className="form-actions">
              <button type="button" className="btn-primary" onClick={importSelected} disabled={importing}>
                {importing ? "Đang lưu..." : `Lưu ${proposals.filter((p) => p.selected).length} mục đã chọn`}
              </button>
              <button type="button" onClick={discardProposals}>
                Huỷ tất cả
              </button>
            </div>
          </div>

          {proposals.map((p, i) => (
            <div className={`card proposal-card ${p.selected ? "" : "proposal-unchecked"}`} key={i}>
              <div className="card-header">
                {p.imageUrl && (
                  <img className="proposal-thumb" src={p.imageUrl} alt="" onError={(e) => (e.target.style.display = "none")} />
                )}
                <label className="proposal-checkbox">
                  <input type="checkbox" checked={p.selected} onChange={() => toggleProposal(i)} />
                  <input
                    className="proposal-name-input"
                    value={p.name}
                    onChange={(e) => updateProposal(i, "name", e.target.value)}
                  />
                </label>
                <input
                  className="proposal-situation-input proposal-category-input"
                  value={p.category}
                  onChange={(e) => updateProposal(i, "category", e.target.value)}
                  placeholder="Ngành hàng"
                />
              </div>
              <div className="form-row">
                <label>
                  Ảnh sản phẩm <span className="hint">(URL)</span>
                  <input value={p.imageUrl || ""} onChange={(e) => updateProposal(i, "imageUrl", e.target.value)} />
                </label>
                <label>
                  Link sản phẩm gốc
                  <input value={p.sourceUrl || ""} onChange={(e) => updateProposal(i, "sourceUrl", e.target.value)} />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Giá niêm yết
                  <input
                    type="number"
                    value={p.price}
                    onChange={(e) => updateProposal(i, "price", e.target.value)}
                  />
                </label>
                <label>
                  Giá sau giảm
                  <input
                    type="number"
                    value={p.priceAfterDiscount || ""}
                    onChange={(e) => updateProposal(i, "priceAfterDiscount", e.target.value)}
                  />
                </label>
                <label>
                  Tồn kho
                  <input
                    type="number"
                    value={p.stock}
                    onChange={(e) => updateProposal(i, "stock", e.target.value)}
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Kích thước
                  <input value={p.size} onChange={(e) => updateProposal(i, "size", e.target.value)} />
                </label>
                <label>
                  Chất liệu
                  <input value={p.material} onChange={(e) => updateProposal(i, "material", e.target.value)} />
                </label>
              </div>
              <label>
                Mô tả <span className="hint">(lấy từ Mô tả ngắn/đầy đủ trong file, AI dùng để tư vấn)</span>
                <textarea
                  rows={3}
                  value={p.description || ""}
                  onChange={(e) => updateProposal(i, "description", e.target.value)}
                />
              </label>
              <label>
                Phù hợp với <span className="hint">(cách nhau bởi dấu phẩy)</span>
                <input value={p.bestFor} onChange={(e) => updateProposal(i, "bestFor", e.target.value)} />
              </label>
              <label>
                KHÔNG phù hợp với
                <input value={p.notFor} onChange={(e) => updateProposal(i, "notFor", e.target.value)} />
              </label>
            </div>
          ))}

          {skipped.length > 0 && (
            <div className="extract-skipped">
              <h4 className="doc-group-title">Đã bỏ qua ({skipped.length})</h4>
              {skipped.map((s, i) => (
                <p key={i} className="meta">
                  <em>{s.excerpt.slice(0, 80)}...</em> — {s.reason}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {importNotice && <p className="upload-ok">{importNotice}</p>}

      <div className="manager-layout">
        <div className="manager-form-column">
          <div className="manager-form upload-box">
            <h3>Tải danh sách sản phẩm từ file</h3>
            <p className="hint">
              Tải bảng giá Excel/CSV hoặc catalogue PDF/DOCX — AI tách thành từng sản phẩm, chỉ lấy đúng
              số liệu có trong file (không bịa giá/thông số). Bạn xem lại trước khi lưu.
            </p>
            <input
              type="file"
              accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md"
              disabled={extractBusy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) handleExtractFile(file);
              }}
            />
            {extractBusy && (
              <div className="extract-progress">
                <p className="empty">
                  {extractProgress
                    ? `Đang tách sản phẩm... (${extractProgress.done}/${extractProgress.total} đoạn)`
                    : "Đang đọc file..."}
                </p>
                {extractProgress && (
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${(extractProgress.done / extractProgress.total) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            )}
            {extractError && <p className="chat-error">{extractError}</p>}
          </div>

          <form className="manager-form" onSubmit={submit}>
            <h3>{editingId ? "Sửa sản phẩm" : "Thêm sản phẩm"}</h3>
            <label>
              Tên sản phẩm
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </label>
            <div className="form-row">
              <label>
                Ngành hàng
                <input
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="Sofa / Laptop..."
                />
              </label>
              <label>
                SKU
                <input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
              </label>
            </div>
            <div className="form-row">
              <label>
                Giá niêm yết
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                />
              </label>
              <label>
                Giá sau giảm
                <input
                  type="number"
                  value={form.priceAfterDiscount}
                  onChange={(e) => setForm((f) => ({ ...f, priceAfterDiscount: e.target.value }))}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Kích thước
                <input value={form.size} onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))} />
              </label>
              <label>
                Tồn kho
                <input
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                />
              </label>
            </div>
            <label>
              Chất liệu
              <input
                value={form.material}
                onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))}
              />
            </label>
            <div className="form-row">
              <label>
                Ảnh sản phẩm <span className="hint">(URL)</span>
                <input
                  value={form.imageUrl}
                  onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                />
              </label>
              <label>
                Link sản phẩm gốc
                <input
                  value={form.sourceUrl}
                  onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
                />
              </label>
            </div>
            <label>
              Mô tả <span className="hint">(AI dùng để tư vấn)</span>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <label>
              Thông số
              <textarea
                rows={2}
                value={form.specs}
                onChange={(e) => setForm((f) => ({ ...f, specs: e.target.value }))}
              />
            </label>
            <label>
              Phù hợp với <span className="hint">(cách nhau bởi dấu phẩy — AI dùng để tư vấn)</span>
              <textarea
                rows={2}
                value={form.bestFor}
                onChange={(e) => setForm((f) => ({ ...f, bestFor: e.target.value }))}
                placeholder="nhà có trẻ nhỏ, căn hộ nhỏ, ngân sách 12-16 triệu"
              />
            </label>
            <label>
              KHÔNG phù hợp với <span className="hint">(AI sẽ nói thẳng với khách)</span>
              <textarea
                rows={2}
                value={form.notFor}
                onChange={(e) => setForm((f) => ({ ...f, notFor: e.target.value }))}
                placeholder="nhà có thú nuôi, ngân sách dưới 10 triệu"
              />
            </label>
            <label>
              Điểm mạnh
              <textarea
                rows={2}
                value={form.usp}
                onChange={(e) => setForm((f) => ({ ...f, usp: e.target.value }))}
                placeholder="bảo hành 10 năm, da bò Ý nhập khẩu"
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
              placeholder="Tìm theo tên hoặc SKU..."
              value={search}
              onChange={(e) => changeSearch(e.target.value)}
            />
            <select value={categoryFilter} onChange={(e) => changeCategoryFilter(e.target.value)}>
              <option value={CATEGORY_ALL}>Mọi ngành hàng ({products.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c} ({products.filter((p) => p.category === c).length})
                </option>
              ))}
            </select>
          </div>

          <div className="list-bulk-bar">
            <label className="bulk-select-all">
              <input
                type="checkbox"
                checked={filteredProducts.length > 0 && filteredProducts.every((p) => selectedIds.has(p._id))}
                onChange={toggleSelectAllFiltered}
              />
              Chọn tất cả ({filteredProducts.length})
            </label>
            <p className="knowledge-result-count">
              {filteredProducts.length} kết quả
              {(search || categoryFilter !== CATEGORY_ALL) && " (đã lọc)"}
            </p>
            {selectedIds.size > 0 && (
              <button type="button" className="danger" onClick={removeSelected} disabled={bulkDeleting}>
                {bulkDeleting ? "Đang xoá..." : `Xoá ${selectedIds.size} đã chọn`}
              </button>
            )}
          </div>

          {pagedProducts.length === 0 && <p className="empty">Không có sản phẩm nào phù hợp bộ lọc.</p>}
          {pagedProducts.map((p) => (
            <div className="card" key={p._id}>
              <div className="card-header">
                <div
                  className="card-title-with-thumb card-clickable-area"
                  onClick={() => setViewingProduct(p)}
                >
                  <input
                    type="checkbox"
                    className="card-select-checkbox"
                    checked={selectedIds.has(p._id)}
                    onChange={() => toggleSelected(p._id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {p.imageUrl && (
                    <img className="proposal-thumb" src={p.imageUrl} alt="" onError={(e) => (e.target.style.display = "none")} />
                  )}
                  <div>
                    <strong>{p.name}</strong>
                    {p.category && <span className="tag">{p.category}</span>}
                    {p.sourceUrl && (
                      <a
                        className="tag tag-link"
                        href={p.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Link gốc
                      </a>
                    )}
                  </div>
                </div>
                <div className="card-actions">
                  <button type="button" onClick={() => onViewDocs(p._id)}>
                    Tài liệu ({docCount(p._id)})
                  </button>
                  <button type="button" onClick={() => edit(p)}>
                    Sửa
                  </button>
                  <button type="button" className="danger" onClick={() => remove(p._id)}>
                    Xoá
                  </button>
                </div>
              </div>

              <p className="price-line card-clickable-area" onClick={() => setViewingProduct(p)}>
                {p.priceAfterDiscount ? (
                  <>
                    <s>{money(p.price)}</s> <strong>{money(p.priceAfterDiscount)}</strong>
                  </>
                ) : (
                  <strong>{money(p.price)}</strong>
                )}
                {p.size && <span className="meta"> · {p.size}</span>}
                {p.material && <span className="meta"> · {p.material}</span>}
                <span className="meta"> · tồn {p.stock}</span>
              </p>

              {p.bestFor?.length > 0 && <p className="fit good">Phù hợp: {p.bestFor.join(", ")}</p>}
              {p.notFor?.length > 0 && <p className="fit bad">Không phù hợp: {p.notFor.join(", ")}</p>}
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

      {viewingProduct && (
        <Modal
          title={viewingProduct.name}
          subtitle={`${viewingProduct.category || "Chưa phân loại"} · tồn ${viewingProduct.stock || 0}${
            viewingProduct.sourceUrl ? ` · ${viewingProduct.sourceUrl}` : ""
          }`}
          onClose={() => setViewingProduct(null)}
          actions={
            <>
              <button
                type="button"
                onClick={() => {
                  edit(viewingProduct);
                  setViewingProduct(null);
                }}
              >
                Sửa
              </button>
              <button type="button" onClick={() => setViewingProduct(null)}>
                Đóng
              </button>
            </>
          }
        >
          {viewingProduct.imageUrl && (
            <img
              src={viewingProduct.imageUrl}
              alt=""
              className="modal-product-image"
              onError={(e) => (e.target.style.display = "none")}
            />
          )}
          <p className="price-line">
            {viewingProduct.priceAfterDiscount ? (
              <>
                <s>{money(viewingProduct.price)}</s> <strong>{money(viewingProduct.priceAfterDiscount)}</strong>
              </>
            ) : (
              <strong>{money(viewingProduct.price)}</strong>
            )}
            {viewingProduct.sku && <span className="meta"> · SKU: {viewingProduct.sku}</span>}
          </p>
          {viewingProduct.size && (
            <p className="meta">
              <strong>Kích thước:</strong> {viewingProduct.size}
            </p>
          )}
          {viewingProduct.material && (
            <p className="meta">
              <strong>Chất liệu:</strong> {viewingProduct.material}
            </p>
          )}
          {viewingProduct.description && (
            <p className="modal-content-text">{viewingProduct.description}</p>
          )}
          {viewingProduct.specs && (
            <p className="modal-content-text">
              <strong>Thông số:</strong>
              <br />
              {viewingProduct.specs}
            </p>
          )}
          {viewingProduct.bestFor?.length > 0 && (
            <p className="fit good">Phù hợp: {viewingProduct.bestFor.join(", ")}</p>
          )}
          {viewingProduct.notFor?.length > 0 && (
            <p className="fit bad">Không phù hợp: {viewingProduct.notFor.join(", ")}</p>
          )}
          {viewingProduct.usp?.length > 0 && (
            <p className="meta">
              <strong>Điểm mạnh:</strong> {viewingProduct.usp.join(", ")}
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
