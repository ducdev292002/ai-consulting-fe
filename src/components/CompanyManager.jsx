import { useState } from "react";
import { api } from "../api";

const empty = { name: "", website: "", intro: "", usp: "", brandVoice: "Thân thiện, chuyên nghiệp" };

export default function CompanyManager({ companies, setCompanies, selectedId, setSelectedId }) {
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
    if (!form.name.trim()) return;
    setSaving(true);
    setError("");

    const payload = {
      name: form.name.trim(),
      website: form.website.trim(),
      intro: form.intro.trim(),
      brandVoice: form.brandVoice.trim(),
      usp: form.usp
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    try {
      if (editingId) {
        const updated = await api.updateCompany(editingId, payload);
        setCompanies((list) => list.map((c) => (c._id === editingId ? updated : c)));
      } else {
        const created = await api.createCompany(payload);
        setCompanies((list) => [...list, created]);
        setSelectedId(created._id);
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
      name: c.name,
      website: c.website || "",
      intro: c.intro || "",
      usp: (c.usp || []).join("\n"),
      brandVoice: c.brandVoice || "",
    });
  };

  const remove = async (id) => {
    try {
      await api.deleteCompany(id);
      setCompanies((list) => list.filter((c) => c._id !== id));
      if (selectedId === id) setSelectedId(null);
      if (editingId === id) resetForm();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="manager-layout">
      <form className="manager-form" onSubmit={submit}>
        <h3>{editingId ? "Sửa công ty" : "Thêm công ty"}</h3>
        <label>
          Tên công ty
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </label>
        <label>
          Website
          <input
            value={form.website}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            placeholder="https://..."
          />
        </label>
        <label>
          Giới thiệu công ty
          <textarea
            rows={3}
            value={form.intro}
            onChange={(e) => setForm((f) => ({ ...f, intro: e.target.value }))}
          />
        </label>
        <label>
          Điểm mạnh <span className="hint">(mỗi dòng một điểm)</span>
          <textarea
            rows={4}
            value={form.usp}
            onChange={(e) => setForm((f) => ({ ...f, usp: e.target.value }))}
            placeholder={"Da bò Ý nhập khẩu 100%\nBảo hành 10 năm"}
          />
        </label>
        <label>
          Giọng điệu thương hiệu
          <input
            value={form.brandVoice}
            onChange={(e) => setForm((f) => ({ ...f, brandVoice: e.target.value }))}
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
        {companies.length === 0 && <p className="empty">Chưa có công ty nào.</p>}
        {companies.map((c) => (
          <div className={`card ${selectedId === c._id ? "selected" : ""}`} key={c._id}>
            <div className="card-header">
              <div>
                <strong>{c.name}</strong>
                {selectedId === c._id && <span className="tag">đang chọn</span>}
              </div>
              <div className="card-actions">
                <button type="button" className="btn-primary" onClick={() => setSelectedId(c._id)}>
                  Chọn
                </button>
                <button type="button" onClick={() => edit(c)}>
                  Sửa
                </button>
                <button type="button" className="danger" onClick={() => remove(c._id)}>
                  Xoá
                </button>
              </div>
            </div>
            {c.website && <p className="meta">{c.website}</p>}
            {c.intro && <p className="clamp">{c.intro}</p>}
            {c.usp?.length > 0 && <p className="fit good">{c.usp.join(" · ")}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
