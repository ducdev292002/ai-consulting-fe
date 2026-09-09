import { Fragment, useState } from "react";

// Sơ đồ chỉ để XEM luồng giai đoạn + kịch bản đang có — không phải nơi lập trình luồng cứng.
// AI vẫn tự quyết định lúc chạy (dựa trên prompt + tool), sơ đồ này chỉ trực quan hoá lại đúng
// dữ liệu Script/giai đoạn đã có trong hệ thống để dễ nắm tổng quan hơn là đọc danh sách dài.
const MAIN_FLOW = [
  { value: "discovery", label: "Khám phá nhu cầu", hint: "Khách mới, chưa rõ nhu cầu" },
  { value: "advising", label: "Tư vấn giải pháp", hint: "Đã biết nhu cầu + ngân sách" },
  { value: "objection", label: "Xử lý phản đối", hint: "Khách chê đắt / so sánh / chần chừ" },
  { value: "closing", label: "Chốt đơn", hint: "Khách đồng ý / xin SĐT" },
  { value: "won", label: "Sau khi chốt", hint: "Đã có đơn / đã có SĐT" },
];

const LOST_STAGE = { value: "lost", label: "Khách từ chối", hint: "Có thể xảy ra ở bất kỳ giai đoạn nào" };

export default function StageFlowMap({ scripts, company, onEdit, onRemove, onCopyToCustomize }) {
  const [selected, setSelected] = useState(null);

  const scriptsFor = (stage) => scripts.filter((s) => (s.stage || "discovery") === stage);

  const renderNode = (stage, isLost) => {
    const list = scriptsFor(stage.value);
    const defaultCount = list.filter((s) => !s.companyId).length;
    const customCount = list.filter((s) => s.companyId).length;
    const isSelected = selected === stage.value;

    return (
      <button
        type="button"
        key={stage.value}
        className={`stage-node ${isLost ? "stage-node-lost" : ""} ${isSelected ? "stage-node-active" : ""}`}
        onClick={() => setSelected(isSelected ? null : stage.value)}
      >
        <strong>{stage.label}</strong>
        <span className="stage-node-hint">{stage.hint}</span>
        <span className="stage-node-count">
          {list.length} kịch bản
          {list.length > 0 && ` (${defaultCount} mặc định · ${customCount} riêng)`}
        </span>
      </button>
    );
  };

  const selectedStage = MAIN_FLOW.find((s) => s.value === selected) || (selected === "lost" ? LOST_STAGE : null);
  const selectedScripts = selected ? scriptsFor(selected) : [];

  return (
    <div className="stage-flow">
      <div className="stage-flow-row">
        {MAIN_FLOW.map((stage, i) => (
          <Fragment key={stage.value}>
            {renderNode(stage, false)}
            {i < MAIN_FLOW.length - 1 && <span className="stage-arrow">→</span>}
          </Fragment>
        ))}
      </div>

      <div className="stage-flow-side">
        <span className="stage-side-connector">⤳ có thể xảy ra từ bất kỳ giai đoạn nào</span>
        {renderNode(LOST_STAGE, true)}
      </div>

      {selectedStage && (
        <div className="stage-detail-panel">
          <h4>
            {selectedStage.label} <span className="hint">— {selectedScripts.length} kịch bản</span>
          </h4>
          {selectedScripts.length === 0 && (
            <p className="empty">Chưa có kịch bản nào cho giai đoạn này.</p>
          )}
          {selectedScripts.map((s) => {
            const isDefault = !s.companyId;
            return (
              <div className={`card ${isDefault ? "card-default" : ""}`} key={s._id}>
                <div className="card-header">
                  <div>
                    <strong>{s.name}</strong>
                    {isDefault ? (
                      <span className="tag default-tag">Mặc định — mọi công ty</span>
                    ) : (
                      <span className="tag">Riêng của {company.name}</span>
                    )}
                  </div>
                  <div className="card-actions">
                    {isDefault ? (
                      <button type="button" onClick={() => onCopyToCustomize(s)}>
                        Sao chép để tuỳ chỉnh
                      </button>
                    ) : (
                      <>
                        <button type="button" onClick={() => onEdit(s)}>
                          Sửa
                        </button>
                        <button type="button" className="danger" onClick={() => onRemove(s._id)}>
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
        </div>
      )}
    </div>
  );
}
