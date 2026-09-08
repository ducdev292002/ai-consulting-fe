import { useState } from "react";
import { api } from "../api";

const empty = { competitorName: "", productName: "", price: "", productId: "", source: "", note: "" };

const money = (n) => (typeof n === "number" && n > 0 ? n.toLocaleString("vi-VN") + "đ" : "—");

export default function CompetitorManager({ company, competitors, setCompetitors, products }) {
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const resetForm = () => {
    setForm(empty);
    setEditingId(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.competitorName.trim() || !form.productName.trim()) return;
    setSaving(true);
    setError("");

    const payload = {
      companyId: company._id,
      competitorName: form.competitorName.trim(),
      productName: form.productName.trim(),
      price: Number(form.price) || 0,
      productId: form.productId || null,
      source: form.source.trim(),
      note: form.note.trim(),
    };

    try {
      if (editingId) {
        const updated = await api.updateCompetitor(editingId, payload);
        setCompetitors((list) => list.map((c) => (c._id === editingId ? updated : c)));
      } else {
        const created = await api.createCompetitor(payload);
        setCompetitors((list) => [...list, created]);
      }
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const edit = (c) => {
    setEditingId(c._id);
    setForm({
      competitorName: c.competitorName,
      productName: c.productName,
      price: c.price || "",
      productId: c.productId || "",
      source: c.source || "",
      note: c.note || "",
    });
  };

  const remove = async (id) => {
    try {
      await api.deleteCompetitor(id);
      setCompetitors((list) => list.filter((c) => c._id !== id));
      if (editingId === id) resetForm();
    } catch (err) {
      setError(err.message);
    }
  };

  const ourProduct = (id) => products.find((p) => p._id === id);

  return (
    <div className="manager-layout">
      <form className="manager-form" onSubmit={submit}>
        <h3>{editingId ? "Sửa dữ liệu đối thủ" : "Thêm giá đối thủ / thị trường"}</h3>
        <label>
          Tên đối thủ
          <input
            value={form.competitorName}
            onChange={(e) => setForm((f) => ({ ...f, competitorName: e.target.value }))}
            placeholder="VD: Đối thủ A, sàn TMĐT"
            required
          />
        </label>
        <label>
          Sản phẩm của đối thủ
          <input
            value={form.productName}
            onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))}
            required
          />
        </label>
        <label>
          Giá đối thủ (VNĐ)
          <input
            type="number"
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          />
        </label>
        <label>
          So sánh với sản phẩm của mình
          <select
            value={form.productId}
            onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
          >
            <option value="">-- Không gắn sản phẩm cụ thể --</option>
            {products.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nguồn dữ liệu
          <input
            value={form.source}
            onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
            placeholder="VD: Khảo sát showroom 08/2026"
          />
        </label>
        <label>
          Ghi chú khác biệt <span className="hint">(AI dùng để giải thích vì sao giá khác)</span>
          <textarea
            rows={3}
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="Rẻ hơn nhưng dùng da PU, bảo hành 1 năm, không đổi trả"
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
        {competitors.length === 0 && <p className="empty">Chưa có dữ liệu đối thủ nào.</p>}
        {competitors.map((c) => {
          const mine = ourProduct(c.productId);
          const minePrice = mine?.priceAfterDiscount ?? mine?.price;
          const diff = minePrice && c.price ? minePrice - c.price : null;

          return (
            <div className="card" key={c._id}>
              <div className="card-header">
                <div>
                  <strong>{c.competitorName}</strong>
                  <span className="tag">{money(c.price)}</span>
                </div>
                <div className="card-actions">
                  <button type="button" onClick={() => edit(c)}>
                    Sửa
                  </button>
                  <button type="button" className="danger" onClick={() => remove(c._id)}>
                    Xoá
                  </button>
                </div>
              </div>
              <p className="meta">
                {c.productName}
                {c.source && ` · ${c.source}`}
              </p>
              {mine && (
                <p className={`fit ${diff > 0 ? "bad" : "good"}`}>
                  So với "{mine.name}" ({money(minePrice)}):{" "}
                  {diff === 0
                    ? "ngang giá"
                    : diff > 0
                      ? `mình cao hơn ${money(diff)}`
                      : `mình thấp hơn ${money(Math.abs(diff))}`}
                </p>
              )}
              {c.note && <p className="clamp">{c.note}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
