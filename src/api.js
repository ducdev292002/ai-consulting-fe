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

async function upload(path, formData) {
  const res = await fetch(`${API_BASE}${path}`, { method: "POST", body: formData });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Lỗi API (HTTP ${res.status})`);
  return data;
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

  listKnowledge: (companyId, productId) => request(`/knowledge?${query({ companyId, productId })}`),
  createKnowledge: (body) => request("/knowledge", { method: "POST", body: JSON.stringify(body) }),
  updateKnowledge: (id, body) => request(`/knowledge/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteKnowledge: (id) => request(`/knowledge/${id}`, { method: "DELETE" }),
  reindexKnowledge: (id) => request(`/knowledge/${id}/reindex`, { method: "POST" }),
  uploadKnowledge: (file, { companyId, productId, source, title } = {}) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("companyId", companyId);
    if (productId) formData.append("productId", productId);
    if (source) formData.append("source", source);
    if (title) formData.append("title", title);
    return upload("/knowledge/upload", formData);
  },
  knowledgeFromUrl: (body) => request("/knowledge/from-url", { method: "POST", body: JSON.stringify(body) }),

  listCompetitors: (companyId) => request(`/competitors?${query({ companyId })}`),
  createCompetitor: (body) => request("/competitors", { method: "POST", body: JSON.stringify(body) }),
  updateCompetitor: (id, body) => request(`/competitors/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteCompetitor: (id) => request(`/competitors/${id}`, { method: "DELETE" }),

  listScripts: (companyId) => request(`/scripts?${query({ companyId })}`),
  createScript: (body) => request("/scripts", { method: "POST", body: JSON.stringify(body) }),
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
  getConversation: (companyId, customerKey) =>
    request(`/conversations?${query({ companyId, customerKey })}`),
  clearConversation: (companyId, customerKey) =>
    request(`/conversations?${query({ companyId, customerKey })}`, { method: "DELETE" }),
};
