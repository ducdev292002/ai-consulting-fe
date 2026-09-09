import { useState } from "react";
import { api } from "../api";

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
};

const toList = (text) =>
  text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const money = (n) => (typeof n === "number" && n > 0 ? n.toLocaleString("vi-VN") + "đ" : "—");

export default function ProductManager({ company, products, setProducts, docs, onViewDocs }) {
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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

  const docCount = (productId) => docs.filter((d) => d.productId === productId).length;

  return (
    <div className="manager-layout">
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

      <div className="manager-list">
        {products.length === 0 && <p className="empty">Công ty này chưa có sản phẩm nào.</p>}
        {products.map((p) => (
          <div className="card" key={p._id}>
            <div className="card-header">
              <div>
                <strong>{p.name}</strong>
                {p.category && <span className="tag">{p.category}</span>}
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

            <p className="price-line">
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

            {p.bestFor?.length > 0 && (
              <p className="fit good">Phù hợp: {p.bestFor.join(", ")}</p>
            )}
            {p.notFor?.length > 0 && <p className="fit bad">Không phù hợp: {p.notFor.join(", ")}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
