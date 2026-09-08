import { useState } from "react";
import { api } from "../api";

const STAGES = [
  { value: "discovery", label: "Khám phá nhu cầu" },
  { value: "advising", label: "Tư vấn giải pháp" },
  { value: "objection", label: "Xử lý phản đối" },
  { value: "closing", label: "Chốt đơn" },
  { value: "won", label: "Sau khi chốt" },
  { value: "lost", label: "Khách từ chối" },
];

const empty = { name: "", stage: "discovery", situation: "", content: "" };

export default function ScriptManager({ company, scripts, setScripts }) {
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
    if (!form.name.trim() || !form.content.trim()) return;
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        const updated = await api.updateScript(editingId, form);
        setScripts((list) => list.map((s) => (s._id === editingId ? updated : s)));
      } else {
        const created = await api.createScript({ ...form, companyId: company._id });
        setScripts((list) => [...list, created]);
      }
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const edit = (script) => {
    setEditingId(script._id);
    setForm({
      name: script.name,
      stage: script.stage || "discovery",
      situation: script.situation || "",
      content: script.content,
    });
  };

  const remove = async (id) => {
    setError("");
    try {
      await api.deleteScript(id);
      setScripts((list) => list.filter((s) => s._id !== id));
      if (editingId === id) resetForm();
    } catch (err) {
      setError(err.message);
    }
  };

  const grouped = STAGES.map((s) => ({
    ...s,
    items: scripts.filter((x) => (x.stage || "discovery") === s.value),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="manager-layout">
      <form className="manager-form" onSubmit={submit}>
        <h3>{editingId ? "Sửa kịch bản" : "Thêm kịch bản"}</h3>
        <label>
          Tên kịch bản
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </label>
        <label>
          Giai đoạn áp dụng <span className="hint">(AI chỉ nạp kịch bản của giai đoạn hiện tại)</span>
          <select
            value={form.stage}
            onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))}
          >
            {STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tình huống cụ thể
          <input
            value={form.situation}
            onChange={(e) => setForm((f) => ({ ...f, situation: e.target.value }))}
            placeholder="VD: Khách nói đắt quá"
          />
        </label>
        <label>
          Hướng dẫn chi tiết cho AI
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

      <div className="manager-list">
        {scripts.length === 0 && <p className="empty">Chưa có kịch bản nào.</p>}
        {grouped.map((g) => (
          <div key={g.value} className="doc-group">
            <h4 className="doc-group-title">
              {g.label} <span className="tag">{g.items.length}</span>
            </h4>
            {g.items.map((s) => (
              <div className="card" key={s._id}>
                <div className="card-header">
                  <div>
                    <strong>{s.name}</strong>
                    {s.situation && <span className="tag">{s.situation}</span>}
                  </div>
                  <div className="card-actions">
                    <button type="button" onClick={() => edit(s)}>
                      Sửa
                    </button>
                    <button type="button" className="danger" onClick={() => remove(s._id)}>
                      Xoá
                    </button>
                  </div>
                </div>
                <p className="clamp">{s.content}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
