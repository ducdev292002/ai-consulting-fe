import { useState } from "react";
import { api } from "../api";

const SOURCES = [
  { value: "company", label: "Thông tin công ty" },
  { value: "policy", label: "Chính sách / Quy trình" },
  { value: "industry", label: "Kiến thức ngành" },
  { value: "web", label: "Lấy từ web" },
];

const sourceLabel = (v) => SOURCES.find((s) => s.value === v)?.label || v;

const empty = { title: "", source: "company", content: "" };

export default function KnowledgeManager({ company, docs, setDocs }) {
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [url, setUrl] = useState("");
  const [uploadSource, setUploadSource] = useState("company");

  const resetForm = () => {
    setForm(empty);
    setEditingId(null);
  };

  const afterCreate = (result) => {
    setDocs((list) => [...list, result.doc]);
    setNotice(
      result.indexError
        ? `Đã lưu "${result.doc.title}" nhưng chưa tạo được embedding: ${result.indexError}`
        : `Đã nạp "${result.doc.title}" — ${result.chunkCount} đoạn đã index.`
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (editingId) {
        const result = await api.updateKnowledge(editingId, form);
        setDocs((list) => list.map((d) => (d._id === editingId ? result.doc : d)));
      } else {
        const result = await api.createKnowledge({ ...form, companyId: company._id });
        afterCreate(result);
      }
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (file) => {
    setBusy("upload");
    setError("");
    setNotice("");
    try {
      const result = await api.uploadKnowledge(file, {
        companyId: company._id,
        source: uploadSource,
      });
      afterCreate(result);
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
    setNotice("");
    try {
      const result = await api.knowledgeFromUrl({
        companyId: company._id,
        url: url.trim(),
        source: "web",
      });
      afterCreate(result);
      setUrl("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  const reindex = async (id) => {
    setBusy(id);
    setError("");
    try {
      const result = await api.reindexKnowledge(id);
      setDocs((list) => list.map((d) => (d._id === id ? result.doc : d)));
      setNotice(`Đã index lại: ${result.chunkCount} đoạn.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  const edit = (doc) => {
    setEditingId(doc._id);
    setForm({ title: doc.title, source: doc.source, content: doc.content });
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

  const companyDocs = docs.filter((d) => !d.productId);

  return (
    <div className="manager-layout">
      <div className="manager-form-column">
        <div className="manager-form upload-box">
          <h3>Nạp tri thức từ nguồn ngoài</h3>
          <label>
            Loại tri thức khi upload file
            <select value={uploadSource} onChange={(e) => setUploadSource(e.target.value)}>
              {SOURCES.filter((s) => s.value !== "web").map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <input
            type="file"
            accept=".pdf,.docx,.txt,.md"
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
          <button type="button" onClick={handleFromUrl} disabled={busy === "url" || !url.trim()}>
            {busy === "url" ? "Đang tải trang..." : "Lấy nội dung từ URL"}
          </button>

          {busy === "upload" && <p className="empty">Đang trích xuất + tạo embedding...</p>}
          {notice && <p className="upload-ok">{notice}</p>}
          {error && <p className="chat-error">{error}</p>}
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
            <select
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
            >
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nội dung
            <textarea
              rows={8}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              required
            />
          </label>
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
        {companyDocs.length === 0 && <p className="empty">Chưa có tri thức chung nào.</p>}
        {companyDocs.map((d) => (
          <div className="card" key={d._id}>
            <div className="card-header">
              <div>
                <strong>{d.title}</strong>
                <span className="tag">{sourceLabel(d.source)}</span>
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
                  <a href={d.sourceUrl} target="_blank" rel="noreferrer">
                    nguồn
                  </a>
                </>
              )}
            </p>
            <p className="clamp">{d.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
