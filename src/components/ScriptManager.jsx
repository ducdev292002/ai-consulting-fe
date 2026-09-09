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

const stageLabel = (v) => STAGES.find((s) => s.value === v)?.label || v;

const empty = { name: "", stage: "discovery", situation: "", content: "" };

const STAGE_ALL = "all";
const TYPE_ALL = "all";
const TYPE_DEFAULT = "default";
const TYPE_CUSTOM = "custom";
const PAGE_SIZE = 6;

export default function ScriptManager({ company, scripts, setScripts }) {
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [extractBusy, setExtractBusy] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [proposals, setProposals] = useState(null); // null = chưa có đề xuất nào
  const [skipped, setSkipped] = useState([]);
  const [importing, setImporting] = useState(false);

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState(STAGE_ALL);
  const [typeFilter, setTypeFilter] = useState(TYPE_ALL);
  const [page, setPage] = useState(1);

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

  // Sao chép nội dung 1 kịch bản mặc định thành kịch bản riêng để công ty tuỳ chỉnh
  const copyToCustomize = (script) => {
    setEditingId(null);
    setForm({
      name: script.name + " (tuỳ chỉnh)",
      stage: script.stage || "discovery",
      situation: script.situation || "",
      content: script.content,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  const handleExtractFile = async (file) => {
    setExtractBusy(true);
    setExtractError("");
    setProposals(null);
    setSkipped([]);
    try {
      const result = await api.extractScripts(file, company._id);
      setProposals(result.scripts.map((s) => ({ ...s, selected: true })));
      setSkipped(result.skipped || []);
    } catch (err) {
      setExtractError(err.message);
    } finally {
      setExtractBusy(false);
    }
  };

  const updateProposal = (index, field, value) => {
    setProposals((list) => list.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  const toggleProposal = (index) => {
    setProposals((list) => list.map((p, i) => (i === index ? { ...p, selected: !p.selected } : p)));
  };

  const importSelected = async () => {
    const toImport = proposals.filter((p) => p.selected);
    if (toImport.length === 0) return;
    setImporting(true);
    setExtractError("");
    try {
      const created = [];
      for (const p of toImport) {
        const doc = await api.createScript({
          companyId: company._id,
          name: p.name,
          stage: p.stage,
          situation: p.situation,
          content: p.content,
        });
        created.push(doc);
      }
      setScripts((list) => [...list, ...created]);
      setProposals(null);
      setSkipped([]);
    } catch (err) {
      setExtractError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const changeSearch = (value) => {
    setSearch(value);
    setPage(1);
  };
  const changeStageFilter = (value) => {
    setStageFilter(value);
    setPage(1);
  };
  const changeTypeFilter = (value) => {
    setTypeFilter(value);
    setPage(1);
  };

  const filteredScripts = scripts.filter((s) => {
    const isDefault = !s.companyId;
    if (typeFilter === TYPE_DEFAULT && !isDefault) return false;
    if (typeFilter === TYPE_CUSTOM && isDefault) return false;
    if (stageFilter !== STAGE_ALL && (s.stage || "discovery") !== stageFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (
        !s.name.toLowerCase().includes(q) &&
        !(s.situation || "").toLowerCase().includes(q) &&
        !s.content.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredScripts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedScripts = filteredScripts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <>
      {proposals && (
        <div className="extract-review">
          <div className="extract-review-head">
            <h3>Kịch bản đề xuất ({proposals.length}) — chọn và sửa trước khi lưu</h3>
            <div className="form-actions">
              <button type="button" className="btn-primary" onClick={importSelected} disabled={importing}>
                {importing ? "Đang lưu..." : `Lưu ${proposals.filter((p) => p.selected).length} mục đã chọn`}
              </button>
              <button
                type="button"
                onClick={() => {
                  setProposals(null);
                  setSkipped([]);
                }}
              >
                Huỷ tất cả
              </button>
            </div>
          </div>

          {proposals.map((p, i) => (
            <div className={`card proposal-card ${p.selected ? "" : "proposal-unchecked"}`} key={i}>
              <div className="card-header">
                <label className="proposal-checkbox">
                  <input type="checkbox" checked={p.selected} onChange={() => toggleProposal(i)} />
                  <input
                    className="proposal-name-input"
                    value={p.name}
                    onChange={(e) => updateProposal(i, "name", e.target.value)}
                  />
                </label>
                <select value={p.stage} onChange={(e) => updateProposal(i, "stage", e.target.value)}>
                  {STAGES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <input
                className="proposal-situation-input"
                value={p.situation}
                onChange={(e) => updateProposal(i, "situation", e.target.value)}
                placeholder="Tình huống áp dụng"
              />
              <textarea
                rows={3}
                value={p.content}
                onChange={(e) => updateProposal(i, "content", e.target.value)}
              />
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

      <div className="manager-layout">
        <div className="manager-form-column">
          <div className="manager-form upload-box">
            <h3>Tải kịch bản từ file</h3>
            <p className="hint">
              AI tự tách file thành từng kịch bản riêng theo đúng giai đoạn, bỏ qua phần không phải kịch
              bản hội thoại (VD: nội dung quảng cáo). Bạn xem lại, sửa nếu cần, rồi mới chọn lưu.
            </p>
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md"
              disabled={extractBusy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) handleExtractFile(file);
              }}
            />
            {extractBusy && <p className="empty">Đang đọc file và tách kịch bản...</p>}
            {extractError && <p className="chat-error">{extractError}</p>}
          </div>

          <form className="manager-form" onSubmit={submit}>
            <h3>{editingId ? "Sửa kịch bản riêng" : "Thêm kịch bản riêng cho công ty này"}</h3>
            <p className="hint">
              Bên dưới còn có sẵn kịch bản MẶC ĐỊNH áp dụng cho mọi công ty. Chỉ tạo kịch bản riêng ở đây
              khi công ty này cần cách xử lý khác đi.
            </p>
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
              <select value={form.stage} onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))}>
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
        </div>

        <div className="manager-list">
          <div className="knowledge-filter-bar">
            <input
              type="text"
              className="knowledge-search"
              placeholder="Tìm theo tên, tình huống hoặc nội dung..."
              value={search}
              onChange={(e) => changeSearch(e.target.value)}
            />
            <select value={stageFilter} onChange={(e) => changeStageFilter(e.target.value)}>
              <option value={STAGE_ALL}>Mọi giai đoạn</option>
              {STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label} ({scripts.filter((x) => (x.stage || "discovery") === s.value).length})
                </option>
              ))}
            </select>
            <select value={typeFilter} onChange={(e) => changeTypeFilter(e.target.value)}>
              <option value={TYPE_ALL}>Mặc định + riêng ({scripts.length})</option>
              <option value={TYPE_DEFAULT}>
                Chỉ mặc định ({scripts.filter((s) => !s.companyId).length})
              </option>
              <option value={TYPE_CUSTOM}>
                Chỉ riêng của {company.name} ({scripts.filter((s) => s.companyId).length})
              </option>
            </select>
          </div>

          <p className="knowledge-result-count">
            {filteredScripts.length} kết quả
            {(search || stageFilter !== STAGE_ALL || typeFilter !== TYPE_ALL) && " (đã lọc)"}
          </p>

          {pagedScripts.length === 0 && <p className="empty">Không có kịch bản nào phù hợp bộ lọc.</p>}
          {pagedScripts.map((s) => {
            const isDefault = !s.companyId;
            return (
              <div className={`card ${isDefault ? "card-default" : ""}`} key={s._id}>
                <div className="card-header">
                  <div>
                    <strong>{s.name}</strong>
                    <span className="tag">{stageLabel(s.stage || "discovery")}</span>
                    {isDefault ? (
                      <span className="tag default-tag">Mặc định — mọi công ty</span>
                    ) : (
                      <span className="tag">Riêng của {company.name}</span>
                    )}
                  </div>
                  <div className="card-actions">
                    {isDefault ? (
                      <button type="button" onClick={() => copyToCustomize(s)}>
                        Sao chép để tuỳ chỉnh
                      </button>
                    ) : (
                      <>
                        <button type="button" onClick={() => edit(s)}>
                          Sửa
                        </button>
                        <button type="button" className="danger" onClick={() => remove(s._id)}>
                          Xoá
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {s.situation && <p className="meta">{s.situation}</p>}
                <p className="clamp">{s.content}</p>
              </div>
            );
          })}

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
    </>
  );
}
