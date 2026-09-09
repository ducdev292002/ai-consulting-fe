const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error || `Lỗi API (HTTP ${res.status})`);
  }
  return data;
}

// Dùng cho các tác vụ AI xử lý nhiều đoạn/nhiều trang (tách sản phẩm, kịch bản, quét web...).
// Server trả về NDJSON (mỗi dòng 1 sự kiện JSON) thay vì 1 JSON duy nhất, để báo tiến trình
// (VD "đã xong đoạn 3/8") — onProgress được gọi mỗi lần có dòng "progress", kết quả cuối
// cùng lấy từ dòng "done". Nếu server trả lỗi HTTP (VD thiếu companyId) ngay từ đầu (chưa kịp
// chuyển sang chế độ stream), vẫn xử lý như JSON lỗi bình thường.
async function requestWithProgress(path, fetchOptions, onProgress) {
  const res = await fetch(`${API_BASE}${path}`, fetchOptions);

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `Lỗi API (HTTP ${res.status})`);
  }

  // Một số đường xử lý (VD: file Excel có cột chuẩn, đọc trực tiếp không qua AI) đủ nhanh
  // nên server trả JSON thường thay vì NDJSON có tiến trình — nhận diện qua Content-Type.
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("x-ndjson")) {
    return res.json();
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = null;
  let errorMessage = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line) continue;

      const event = JSON.parse(line);
      if (event.type === "progress") onProgress?.(event);
      else if (event.type === "done") result = event.result;
      else if (event.type === "error") errorMessage = event.error;
    }
  }

  if (errorMessage) throw new Error(errorMessage);
  if (result === null) throw new Error("Không nhận được kết quả từ server");
  return result;
}

function uploadWithProgress(path, formData, onProgress) {
  return requestWithProgress(path, { method: "POST", body: formData }, onProgress);

}

function jsonWithProgress(path, body, onProgress) {
  return requestWithProgress(
    path,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    onProgress
  );
}

const query = (params) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

export const api = {
  listCompanies: () => request("/companies"),
  createCompany: (body) => request("/companies", { method: "POST", body: JSON.stringify(body) }),
  updateCompany: (id, body) => request(`/companies/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteCompany: (id) => request(`/companies/${id}`, { method: "DELETE" }),

  listProducts: (companyId) => request(`/products?${query({ companyId })}`),
  createProduct: (body) => request("/products", { method: "POST", body: JSON.stringify(body) }),
  updateProduct: (id, body) => request(`/products/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: "DELETE" }),
  extractProducts: (file, companyId, onProgress) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("companyId", companyId);
    return uploadWithProgress("/products/extract", formData, onProgress);
  },

  listKnowledge: (companyId, productId) => request(`/knowledge?${query({ companyId, productId })}`),
  createKnowledge: (body) => request("/knowledge", { method: "POST", body: JSON.stringify(body) }),
  updateKnowledge: (id, body) => request(`/knowledge/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteKnowledge: (id) => request(`/knowledge/${id}`, { method: "DELETE" }),
  reindexKnowledge: (id) => request(`/knowledge/${id}/reindex`, { method: "POST" }),
  uploadKnowledge: (file, { companyId, productId, source, title } = {}, onProgress) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("companyId", companyId);
    if (productId) formData.append("productId", productId);
    if (source) formData.append("source", source);
    if (title) formData.append("title", title);
    return uploadWithProgress("/knowledge/upload", formData, onProgress);
  },
  knowledgeFromUrl: (body) => request("/knowledge/from-url", { method: "POST", body: JSON.stringify(body) }),
  crawlKnowledge: (body, onProgress) => jsonWithProgress("/knowledge/crawl", body, onProgress),

  listScripts: (companyId) => request(`/scripts?${query({ companyId })}`),
  createScript: (body) => request("/scripts", { method: "POST", body: JSON.stringify(body) }),
  extractScripts: (file, companyId, onProgress) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("companyId", companyId);
    return uploadWithProgress("/scripts/extract", formData, onProgress);
  },
  updateScript: (id, body) => request(`/scripts/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteScript: (id) => request(`/scripts/${id}`, { method: "DELETE" }),

  listLeads: (companyId) => request(`/leads?${query({ companyId })}`),
  getLead: (companyId, customerKey) => request(`/leads?${query({ companyId, customerKey })}`),
  deleteLead: (companyId, customerKey) =>
    request(`/leads?${query({ companyId, customerKey })}`, { method: "DELETE" }),

  listOrders: (companyId, customerKey) => request(`/orders?${query({ companyId, customerKey })}`),
  updateOrder: (id, body) => request(`/orders/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteOrder: (id) => request(`/orders/${id}`, { method: "DELETE" }),

  sendChat: (body) => request("/chat", { method: "POST", body: JSON.stringify(body) }),
  listConversations: (companyId) => request(`/conversations/list?${query({ companyId })}`),
  getConversation: (companyId, customerKey) =>
    request(`/conversations?${query({ companyId, customerKey })}`),
  clearConversation: (companyId, customerKey) =>
    request(`/conversations?${query({ companyId, customerKey })}`, { method: "DELETE" }),
};
