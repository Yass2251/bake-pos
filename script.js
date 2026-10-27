document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const money = n => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(n) || 0);
  const today = () => dateKey(new Date());
  const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const offsetDate = days => { const d = new Date(); d.setDate(d.getDate() + days); return dateKey(d); };
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
  const categoryNames = { roti: "Roti", donat: "Donat", pastry: "Pastry", kue: "Kue & Cake", cookies: "Cookies", minuman: "Minuman" };
  const categoryName = value => categoryNames[value] || value || "Lainnya";
  const dateLabel = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—";
  const daysLeft = value => {
    if (!value) return Infinity;
    return Math.round((new Date(`${value}T00:00:00`) - new Date(`${today()}T00:00:00`)) / 86400000);
  };
  const toast = message => {
    const el = $("#toast");
    if (!el) return alert(message);
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 2800);
  };

  function demoProducts() {
    return [
      { id: 1, sku: "ROT001", nama: "Roti Cokelat", kategori: "roti", harga: 8000, stok: 25, satuan: "pcs", minimal: 5, emoji: "🍞", kedaluwarsa: offsetDate(5) },
      { id: 2, sku: "ROT002", nama: "Roti Keju", kategori: "roti", harga: 10000, stok: 18, satuan: "pcs", minimal: 5, emoji: "🥖", kedaluwarsa: offsetDate(4) },
      { id: 3, sku: "DON001", nama: "Donat Cokelat", kategori: "donat", harga: 7000, stok: 3, satuan: "pcs", minimal: 5, emoji: "🍩", kedaluwarsa: offsetDate(2) },
      { id: 4, sku: "PAS001", nama: "Croissant", kategori: "pastry", harga: 15000, stok: 12, satuan: "pcs", minimal: 5, emoji: "🥐", kedaluwarsa: offsetDate(3) },
      { id: 5, sku: "KUE001", nama: "Cheesecake", kategori: "kue", harga: 25000, stok: 8, satuan: "pcs", minimal: 3, emoji: "🍰", kedaluwarsa: offsetDate(7) },
      { id: 6, sku: "COO001", nama: "Cookies", kategori: "cookies", harga: 12000, stok: 20, satuan: "pack", minimal: 5, emoji: "🍪", kedaluwarsa: offsetDate(30) },
      { id: 7, sku: "MIN001", nama: "Kopi Susu", kategori: "minuman", harga: 18000, stok: 15, satuan: "cup", minimal: 5, emoji: "☕", kedaluwarsa: offsetDate(10) },
      { id: 8, sku: "DON002", nama: "Donat Stroberi", kategori: "donat", harga: 7000, stok: 0, satuan: "pcs", minimal: 5, emoji: "🍓", kedaluwarsa: offsetDate(-1) }
    ];
  }

  function read(key, fallback) {
    try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
    catch { return fallback; }
  }

  let products = read("bakepos_chatgpt_products", null) || demoProducts();
  let transactions = read("bakepos_chatgpt_transactions", []);
  let cart = [];
  let editingProductId = null;
  let settings = read("bakepos_chatgpt_settings", {
    toko: "Ruang Roti", alamat: "", kontak: "", kasir: "Andi Saputra",
    minimal: 5, peringatan: 3, pesan: "Terima kasih sudah berbelanja di Ruang Roti!"
  });

  function save() {
    localStorage.setItem("bakepos_chatgpt_products", JSON.stringify(products));
    localStorage.setItem("bakepos_chatgpt_transactions", JSON.stringify(transactions));
    localStorage.setItem("bakepos_chatgpt_settings", JSON.stringify(settings));
  }

  function openPage(name) {
    const page = $(`#${name}-page`);
    if (!page) return;
    $$(".page").forEach(el => el.classList.toggle("active", el === page));
    $$(".nav-link").forEach(el => el.classList.toggle("active", el.dataset.page === name));
    const label = ({ dashboard: "Dashboard", kasir: "Kasir POS", produk: "Produk", stok: "Stok & Kedaluwarsa", transaksi: "Transaksi", laporan: "Laporan", pengaturan: "Pengaturan" })[name] || name;
    if ($("#breadcrumb-current")) $("#breadcrumb-current").textContent = label;
    $("#sidebar")?.classList.remove("open");
    if (name === "dashboard") renderDashboard();
    if (name === "kasir") { renderCatalog(); renderCart(); }
    if (name === "produk") renderProducts();
    if (name === "stok") renderStock();
    if (name === "transaksi") renderTransactions();
    if (name === "laporan") renderReport();
    if (name === "pengaturan") fillSettings();
  }

  $$(".nav-link").forEach(button => button.addEventListener("click", () => openPage(button.dataset.page)));
  $$("[data-go]").forEach(button => button.addEventListener("click", () => openPage(button.dataset.go)));
  $("#mobile-menu")?.addEventListener("click", () => $("#sidebar")?.classList.toggle("open"));

  // Dashboard
  const successfulTransactions = () => transactions.filter(t => t.status === "berhasil");
  const transactionsToday = () => successfulTransactions().filter(t => t.tanggal.slice(0, 10) === today());

  function renderDashboard() {
    const todayTransactions = transactionsToday();
    const revenue = todayTransactions.reduce((sum, t) => sum + t.total, 0);
    if ($("#omzet-hari-ini")) $("#omzet-hari-ini").textContent = money(revenue);
    if ($("#jumlah-transaksi")) $("#jumlah-transaksi").textContent = todayTransactions.length;
    if ($("#jumlah-produk")) $("#jumlah-produk").textContent = todayTransactions.reduce((sum, t) => sum + t.itemCount, 0);
    if ($("#jumlah-katalog")) $("#jumlah-katalog").textContent = products.length;

    const low = products.filter(p => p.stok > 0 && p.stok <= p.minimal);
    const expired = products.filter(p => daysLeft(p.kedaluwarsa) <= Number(settings.peringatan || 3));
    if ($("#stok-alert-text")) $("#stok-alert-text").textContent = low.length ? `${low.length} produk perlu restok` : "Semua stok aman";
    if ($("#expiry-alert-text")) $("#expiry-alert-text").textContent = expired.length ? `${expired.length} produk perlu diperiksa` : "Tidak ada peringatan";
    if ($("#alert-count")) $("#alert-count").textContent = low.length + expired.length;

    const chart = $("#grafik-canvas");
    if (chart) {
      const values = [];
      for (let ago = 6; ago >= 0; ago--) {
        const d = new Date();
        d.setDate(d.getDate() - ago);
        const key = dateKey(d);
        const total = successfulTransactions().filter(t => t.tanggal.slice(0, 10) === key).reduce((sum, t) => sum + t.total, 0);
        values.push({ key, label: d.toLocaleDateString("id-ID", { weekday: "short" }), total });
      }
      const max = Math.max(1, ...values.map(v => v.total));
      chart.innerHTML = `<div class="chart-bars">${values.map(v => `<div class="chart-col"><div class="chart-bar ${v.key === today() ? "today-bar" : ""}" title="${money(v.total)}" style="height:${Math.max(3, v.total / max * 145)}px"></div><small>${escapeHTML(v.label)}</small></div>`).join("")}</div><div class="chart-legend"><span></span>Omzet per hari</div>`;
    }

    const rows = [...transactions].reverse().slice(0, 5);
    const body = $("#transaksi-list");
    if (body) body.innerHTML = rows.map(t => `<tr>
      <td><strong>${escapeHTML(t.id)}</strong></td>
      <td>${escapeHTML(new Date(t.tanggal).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }))}</td>
      <td>${t.itemCount} item</td><td>${escapeHTML((t.metode || "").toUpperCase())}</td>
      <td><strong>${money(t.total)}</strong></td><td><span class="status-pill">${escapeHTML(t.status)}</span></td>
    </tr>`).join("");
    $("#dashboard-empty")?.toggleAttribute("hidden", rows.length > 0);
  }

  // Cashier catalog and cart
  function renderCatalog() {
    const host = $("#produk-grid");
    if (!host) return;
    const query = ($("#search-produk")?.value || "").trim().toLowerCase();
    const category = $("#filter-kategori")?.value || "";
    const filtered = products.filter(p => `${p.nama} ${p.sku}`.toLowerCase().includes(query) && (!category || p.kategori === category));
    if ($("#jumlah-produk-tampil")) $("#jumlah-produk-tampil").textContent = `${filtered.length} produk`;
    host.innerHTML = filtered.map(p => {
      const expired = daysLeft(p.kedaluwarsa) < 0;
      const unavailable = p.stok <= 0 || expired;
      return `<article class="product-card">
        <div class="product-art">${escapeHTML(p.emoji || "🥐")}</div>
        <h3>${escapeHTML(p.nama)}</h3><span class="product-sku">${escapeHTML(p.sku)} · ${escapeHTML(categoryName(p.kategori))}</span>
        <div class="product-bottom"><span class="product-price">${money(p.harga)}</span></div>
        <div class="stock-mini">${expired ? "Produk kedaluwarsa" : `Stok tersedia: ${p.stok} ${escapeHTML(p.satuan)}`}</div>
        <button class="add-product" data-add-cart="${p.id}" ${unavailable ? "disabled" : ""}>${expired ? "Kedaluwarsa" : p.stok <= 0 ? "Stok habis" : "+ Tambah"}</button>
      </article>`;
    }).join("") || `<div class="empty-state">Produk tidak ditemukan.</div>`;
  }

  $("#search-produk")?.addEventListener("input", renderCatalog);
  $("#filter-kategori")?.addEventListener("change", renderCatalog);

  $("#produk-grid")?.addEventListener("click", event => {
    const button = event.target.closest("[data-add-cart]");
    if (!button) return;
    const id = Number(button.dataset.addCart);
    const p = products.find(item => item.id === id);
    if (!p || p.stok <= 0 || daysLeft(p.kedaluwarsa) < 0) return;
    const item = cart.find(i => i.id === id);
    if ((item?.jumlah || 0) >= p.stok) return toast("Jumlah di keranjang sudah mencapai stok.");
    if (item) item.jumlah++;
    else cart.push({ id, jumlah: 1 });
    renderCart();
  });

  function cartTotals() {
    const subtotal = cart.reduce((sum, item) => {
      const p = products.find(prod => prod.id === item.id);
      return sum + (p ? p.harga * item.jumlah : 0);
    }, 0);
    const percent = Math.max(0, Math.min(100, Number($("#diskon-persen")?.value) || 0));
    const discount = Math.round(subtotal * percent / 100);
    return { subtotal, discount, total: subtotal - discount };
  }

  function renderCart() {
    const host = $("#keranjang-list");
    if (!host) return;
    const empty = cart.length === 0;
    $("#keranjang-empty")?.toggleAttribute("hidden", !empty);
    $("#keranjang-content")?.toggleAttribute("hidden", empty);
    host.innerHTML = cart.map(item => {
      const p = products.find(prod => prod.id === item.id);
      if (!p) return "";
      return `<div class="cart-line"><div><div class="cart-line-name">${escapeHTML(p.nama)}</div><div class="cart-line-price">${money(p.harga)} / ${escapeHTML(p.satuan)}</div><button class="remove-line" data-remove-cart="${p.id}">Hapus item</button></div>
        <div class="cart-line-right"><div class="cart-line-total">${money(p.harga * item.jumlah)}</div><div class="quantity-control"><button data-change-qty="-1" data-id="${p.id}" aria-label="Kurangi">−</button><span>${item.jumlah}</span><button data-change-qty="1" data-id="${p.id}" aria-label="Tambah">+</button></div></div></div>`;
    }).join("");
    const totals = cartTotals();
    if ($("#item-count")) $("#item-count").textContent = cart.reduce((sum, item) => sum + item.jumlah, 0);
    if ($("#subtotal-rupiah")) $("#subtotal-rupiah").textContent = money(totals.subtotal);
    if ($("#diskon-rupiah")) $("#diskon-rupiah").textContent = money(totals.discount);
    if ($("#total-rupiah")) $("#total-rupiah").textContent = money(totals.total);
  }

  $("#keranjang-list")?.addEventListener("click", event => {
    const remove = event.target.closest("[data-remove-cart]");
    const change = event.target.closest("[data-change-qty]");
    if (remove) cart = cart.filter(i => i.id !== Number(remove.dataset.removeCart));
    if (change) {
      const item = cart.find(i => i.id === Number(change.dataset.id));
      const p = products.find(prod => prod.id === Number(change.dataset.id));
      if (item && p) {
        const next = item.jumlah + Number(change.dataset.changeQty);
        if (next <= 0) cart = cart.filter(i => i.id !== item.id);
        else if (next <= p.stok) item.jumlah = next;
        else toast("Stok tidak mencukupi.");
      }
    }
    renderCart();
  });
  $("#diskon-persen")?.addEventListener("input", renderCart);
  $("#clear-cart-btn")?.addEventListener("click", () => {
    if (!cart.length) return;
    if (confirm("Kosongkan semua isi keranjang?")) { cart = []; renderCart(); }
  });

  // Checkout modal and payment
  function openModal(id) {
    const modal = $(`#${id}`);
    if (!modal) return;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
  }
  function closeModal(id) {
    const modal = $(`#${id}`);
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }
  $$("[data-close]").forEach(button => button.addEventListener("click", () => closeModal(button.dataset.close)));
  $$(".modal").forEach(modal => modal.addEventListener("click", event => {
    if (event.target === modal) closeModal(modal.id);
  }));
  $("#checkout-btn")?.addEventListener("click", () => {
    if (!cart.length) return toast("Keranjang masih kosong.");
    const totals = cartTotals();
    $("#total-modal").textContent = money(totals.total);
    $("#uang-diterima").value = "";
    $("#kembalian-rupiah").textContent = money(0);
    $('input[name="payment"][value="tunai"]').checked = true;
    updatePaymentMethod();
    openModal("modal-checkout");
  });
  function updatePaymentMethod() {
    const method = $('input[name="payment"]:checked')?.value || "tunai";
    $("#tunai-section")?.toggleAttribute("hidden", method !== "tunai");
    $("#qris-debit-section")?.toggleAttribute("hidden", method === "tunai");
    const button = $("#konfirmasi-bayar");
    if (button) button.textContent = method === "tunai" ? "Selesaikan transaksi" : "Konfirmasi pembayaran";
    updateChange();
  }
  function updateChange() {
    const total = cartTotals().total;
    const paid = Number($("#uang-diterima")?.value) || 0;
    if ($("#kembalian-rupiah")) $("#kembalian-rupiah").textContent = money(Math.max(0, paid - total));
  }
  $$('input[name="payment"]').forEach(input => input.addEventListener("change", updatePaymentMethod));
  $("#uang-diterima")?.addEventListener("input", updateChange);

  $("#konfirmasi-bayar")?.addEventListener("click", () => {
    if (!cart.length) return toast("Keranjang masih kosong.");
    const method = $('input[name="payment"]:checked')?.value || "tunai";
    const totals = cartTotals();
    const paid = method === "tunai" ? Number($("#uang-diterima").value) || 0 : totals.total;
    if (method === "tunai" && paid < totals.total) return toast("Uang yang diterima belum mencukupi.");

    for (const item of cart) {
      const p = products.find(prod => prod.id === item.id);
      if (!p || p.stok < item.jumlah) return toast(`Stok ${p?.nama || "produk"} tidak mencukupi.`);
      if (daysLeft(p.kedaluwarsa) < 0) return toast(`${p.nama} sudah kedaluwarsa dan tidak dapat dijual.`);
    }

    const items = cart.map(item => {
      const p = products.find(prod => prod.id === item.id);
      return { id: p.id, sku: p.sku, nama: p.nama, kategori: p.kategori, harga: p.harga, jumlah: item.jumlah };
    });
    cart.forEach(item => {
      const p = products.find(prod => prod.id === item.id);
      p.stok -= item.jumlah;
    });
    const now = new Date();
    transactions.push({
      id: `TRX-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getTime()).slice(-5)}`,
      tanggal: now.toISOString(),
      kasir: settings.kasir,
      items,
      itemCount: items.reduce((sum, i) => sum + i.jumlah, 0),
      subtotal: totals.subtotal,
      diskon: totals.discount,
      total: totals.total,
      dibayar: paid,
      kembalian: Math.max(0, paid - totals.total),
      metode: method,
      status: "berhasil"
    });
    save();
    cart = [];
    closeModal("modal-checkout");
    renderAll();
    toast("Transaksi berhasil disimpan.");
  });

  // Product CRUD modal
  function openProductForm(product = null) {
    editingProductId = product?.id ?? null;
    $("#product-form").reset();
    $("#product-modal-title").textContent = product ? "Edit produk" : "Tambah produk";
    $("#new-name").value = product?.nama || "";
    $("#new-sku").value = product?.sku || "";
    $("#new-category").value = product?.kategori || "roti";
    $("#new-price").value = product?.harga ?? "";
    $("#new-stock").value = product?.stok ?? 10;
    $("#new-unit").value = product?.satuan || "pcs";
    $("#new-minimum").value = product?.minimal ?? Number(settings.minimal || 5);
    $("#new-expiry").value = product?.kedaluwarsa || offsetDate(7);
    $("#new-emoji").value = product?.emoji || "🥐";
    openModal("modal-produk");
  }
  $("#tambah-produk-btn")?.addEventListener("click", () => openProductForm());
  $("#product-form")?.addEventListener("submit", event => {
    event.preventDefault();
    const name = $("#new-name").value.trim();
    const sku = $("#new-sku").value.trim().toUpperCase();
    const category = $("#new-category").value;
    const price = Number($("#new-price").value);
    const stock = Number($("#new-stock").value);
    const unit = $("#new-unit").value.trim();
    const minimum = Number($("#new-minimum").value);
    const expiry = $("#new-expiry").value;
    const emoji = $("#new-emoji").value.trim() || "🥐";
    if (!name || !sku || price <= 0 || stock < 0 || minimum < 0 || !expiry || !unit) return toast("Lengkapi data produk dengan benar.");
    if (products.some(p => p.sku.toLowerCase() === sku.toLowerCase() && p.id !== editingProductId)) return toast("SKU sudah digunakan produk lain.");

    if (editingProductId !== null) {
      const p = products.find(item => item.id === editingProductId);
      if (p) Object.assign(p, { nama: name, sku, kategori: category, harga: price, stok: stock, satuan: unit, minimal: minimum, kedaluwarsa: expiry, emoji });
      toast("Produk berhasil diperbarui.");
    } else {
      products.push({ id: Date.now(), nama: name, sku, kategori: category, harga: price, stok: stock, satuan: unit, minimal: minimum, kedaluwarsa: expiry, emoji });
      toast("Produk baru berhasil ditambahkan.");
    }
    save();
    closeModal("modal-produk");
    renderAll();
  });
  $("#produk-list")?.addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-product]");
    const remove = event.target.closest("[data-delete-product]");
    if (edit) {
      const p = products.find(item => item.id === Number(edit.dataset.editProduct));
      if (p) openProductForm(p);
    }
    if (remove) {
      const p = products.find(item => item.id === Number(remove.dataset.deleteProduct));
      if (!p) return;
      if (!confirm(`Hapus produk ${p.nama}?`)) return;
      products = products.filter(item => item.id !== p.id);
      cart = cart.filter(item => item.id !== p.id);
      save();
      renderAll();
      toast("Produk berhasil dihapus.");
    }
  });

  function renderProducts() {
    const body = $("#produk-list");
    if (!body) return;
    const query = ($("#search-produk-admin")?.value || "").toLowerCase();
    const category = $("#filter-kategori-admin")?.value || "";
    const list = products.filter(p => `${p.nama} ${p.sku}`.toLowerCase().includes(query) && (!category || p.kategori === category));
    body.innerHTML = list.map(p => `<tr><td><div class="table-product table-product-cell"><span class="table-emoji">${escapeHTML(p.emoji || "🥐")}</span><span><strong>${escapeHTML(p.nama)}</strong><small>${escapeHTML(p.satuan)}</small></span></div></td>
      <td>${escapeHTML(p.sku)}</td><td>${escapeHTML(categoryName(p.kategori))}</td><td><strong>${money(p.harga)}</strong></td><td>${p.stok}</td><td>${dateLabel(p.kedaluwarsa)}</td>
      <td><div class="action-cell"><button class="small-action edit" data-edit-product="${p.id}">Edit</button><button class="small-action delete" data-delete-product="${p.id}">Hapus</button></div></td></tr>`).join("");
    $("#produk-empty")?.toggleAttribute("hidden", list.length > 0);
  }
  $("#search-produk-admin")?.addEventListener("input", renderProducts);
  $("#filter-kategori-admin")?.addEventListener("change", renderProducts);

  // Inventory
  function stockStatus(p) {
    const days = daysLeft(p.kedaluwarsa);
    if (days < 0) return "kedaluwarsa";
    if (p.stok <= 0) return "habis";
    if (days <= Number(settings.peringatan || 3)) return "dekat";
    if (p.stok <= p.minimal) return "menipis";
    return "aman";
  }
  const stockLabels = { aman: "Aman", menipis: "Menipis", habis: "Stok habis", dekat: "Segera kedaluwarsa", kedaluwarsa: "Kedaluwarsa" };
  function renderStock() {
    const body = $("#stok-list");
    if (!body) return;
    const category = $("#filter-kategori-stok")?.value || "";
    const status = $("#filter-status-stok")?.value || "";
    const low = products.filter(p => p.stok > 0 && p.stok <= p.minimal).length;
    const out = products.filter(p => p.stok <= 0).length;
    const exp = products.filter(p => daysLeft(p.kedaluwarsa) <= Number(settings.peringatan || 3)).length;
    if ($("#stock-low-count")) $("#stock-low-count").textContent = low;
    if ($("#stock-out-count")) $("#stock-out-count").textContent = out;
    if ($("#stock-expiry-count")) $("#stock-expiry-count").textContent = exp;
    const list = products.filter(p => (!category || p.kategori === category) && (!status || stockStatus(p) === status));
    body.innerHTML = list.map(p => {
      const state = stockStatus(p);
      const pillClass = state === "aman" ? "" : ["menipis", "dekat"].includes(state) ? "warning" : "danger";
      const days = daysLeft(p.kedaluwarsa);
      return `<tr><td><div class="table-product"><span class="table-emoji">${escapeHTML(p.emoji || "🥐")}</span><span><strong>${escapeHTML(p.nama)}</strong><small>${escapeHTML(p.sku)}</small></span></div></td><td>${p.stok} ${escapeHTML(p.satuan)}</td><td>${p.minimal}</td><td>${dateLabel(p.kedaluwarsa)}</td><td>${days === Infinity ? "—" : days < 0 ? `${Math.abs(days)} hari lewat` : `${days} hari`}</td><td><span class="status-pill ${pillClass}">${stockLabels[state]}</span></td><td><button class="small-action stock" data-adjust-stock="${p.id}">Sesuaikan</button></td></tr>`;
    }).join("") || `<tr><td colspan="7" class="empty-state">Tidak ada produk pada filter ini.</td></tr>`;
  }
  $("#filter-kategori-stok")?.addEventListener("change", renderStock);
  $("#filter-status-stok")?.addEventListener("change", renderStock);
  $("#stok-list")?.addEventListener("click", event => {
    const button = event.target.closest("[data-adjust-stock]");
    if (!button) return;
    const p = products.find(item => item.id === Number(button.dataset.adjustStock));
    if (!p) return;
    const answer = prompt(`Stok saat ini ${p.stok}. Masukkan stok akhir untuk ${p.nama}:`, String(p.stok));
    if (answer === null) return;
    const next = Number(answer);
    if (!Number.isInteger(next) || next < 0) return toast("Stok harus berupa bilangan bulat nol atau lebih.");
    p.stok = next;
    save();
    renderAll();
    toast("Stok berhasil disesuaikan.");
  });

  // Transaction history
  function filteredTransactions() {
    const query = ($("#cari-id")?.value || "").toLowerCase();
    const method = $("#filter-metode")?.value || "";
    const status = $("#filter-status-transaksi")?.value || "";
    const period = $("#filter-periode")?.value || "semua";
    const now = new Date();
    return [...transactions].reverse().filter(t => {
      if (!t.id.toLowerCase().includes(query)) return false;
      if (method && t.metode !== method) return false;
      if (status && t.status !== status) return false;
      const date = new Date(t.tanggal);
      if (period === "hari-ini" && t.tanggal.slice(0, 10) !== today()) return false;
      if (period === "7-hari" && ((now - date) / 86400000 < 0 || (now - date) / 86400000 >= 7)) return false;
      if (period === "bulan-ini" && (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear())) return false;
      return true;
    });
  }
  function renderTransactions() {
    const body = $("#riwayat-list");
    if (!body) return;
    const list = filteredTransactions();
    body.innerHTML = list.map(t => `<tr><td><strong>${escapeHTML(t.id)}</strong></td><td>${escapeHTML(new Date(t.tanggal).toLocaleString("id-ID"))}</td><td>${escapeHTML(t.kasir)}</td><td>${t.itemCount} item</td><td><strong>${money(t.total)}</strong></td><td>${escapeHTML(t.metode.toUpperCase())}</td><td><span class="status-pill">${escapeHTML(t.status)}</span></td><td><button class="small-action" data-transaction-detail="${escapeHTML(t.id)}">Detail</button></td></tr>`).join("");
    $("#transaksi-empty")?.toggleAttribute("hidden", list.length > 0);
  }
  ["cari-id", "filter-metode", "filter-status-transaksi", "filter-periode"].forEach(id => {
    $(`#${id}`)?.addEventListener("input", renderTransactions);
    $(`#${id}`)?.addEventListener("change", renderTransactions);
  });
  $("#riwayat-list")?.addEventListener("click", event => {
    const button = event.target.closest("[data-transaction-detail]");
    if (!button) return;
    const t = transactions.find(item => item.id === button.dataset.transactionDetail);
    if (!t) return;
    const lines = t.items.map(i => `${i.nama} x${i.jumlah} — ${money(i.harga * i.jumlah)}`).join("\n");
    alert(`Detail ${t.id}\n${lines}\n\nSubtotal: ${money(t.subtotal)}\nDiskon: ${money(t.diskon)}\nTotal: ${money(t.total)}\nMetode: ${t.metode.toUpperCase()}\nKasir: ${t.kasir}`);
  });

  // Reports
  function reportTransactions() {
    const period = $("#filter-periode-laporan")?.value || "hari-ini";
    const start = $("#tanggal-awal")?.value;
    const end = $("#tanggal-akhir")?.value;
    const now = new Date();
    return successfulTransactions().filter(t => {
      const date = new Date(t.tanggal);
      if (period === "hari-ini") return t.tanggal.slice(0, 10) === today();
      if (period === "7-hari") { const diff = (now - date) / 86400000; return diff >= 0 && diff < 7; }
      if (period === "bulan-ini") return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      if (period === "kustom") return Boolean(start && end && t.tanggal.slice(0, 10) >= start && t.tanggal.slice(0, 10) <= end);
      return true;
    });
  }
  function renderReport() {
    const list = reportTransactions();
    const revenue = list.reduce((sum, t) => sum + t.total, 0);
    const itemCount = list.reduce((sum, t) => sum + t.itemCount, 0);
    if ($("#total-omzet")) $("#total-omzet").textContent = money(revenue);
    if ($("#jumlah-transaksi-laporan")) $("#jumlah-transaksi-laporan").textContent = list.length;
    if ($("#total-produk-terjual")) $("#total-produk-terjual").textContent = itemCount;
    if ($("#rata-rata")) $("#rata-rata").textContent = money(list.length ? revenue / list.length : 0);
    const byCategory = {};
    list.forEach(t => t.items.forEach(i => { byCategory[i.kategori] = (byCategory[i.kategori] || 0) + i.harga * i.jumlah; }));
    const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...entries.map(e => e[1]));
    const host = $("#grafik-kategori");
    if (host) host.innerHTML = entries.length ? entries.map(([category, total]) => `<div class="category-row"><span>${escapeHTML(categoryName(category))}</span><div class="category-track"><div class="category-fill" style="width:${total / max * 100}%"></div></div><strong>${money(total)}</strong></div>`).join("") : `<div class="empty-state">Belum ada penjualan pada periode ini.</div>`;
  }
  $("#filter-periode-laporan")?.addEventListener("change", () => {
    const custom = $("#filter-periode-laporan").value === "kustom";
    $("#tanggal-awal")?.toggleAttribute("hidden", !custom);
    $("#tanggal-akhir")?.toggleAttribute("hidden", !custom);
    renderReport();
  });
  $("#tanggal-awal")?.addEventListener("change", renderReport);
  $("#tanggal-akhir")?.addEventListener("change", renderReport);
  $("#export-csv")?.addEventListener("click", () => {
    const list = reportTransactions();
    if (!list.length) return toast("Tidak ada transaksi pada periode ini.");
    const columns = ["ID Transaksi", "Tanggal", "Kasir", "Item", "Subtotal", "Diskon", "Total", "Dibayar", "Kembalian", "Metode", "Status"];
    const rows = list.map(t => [t.id, t.tanggal, t.kasir, t.itemCount, t.subtotal, t.diskon, t.total, t.dibayar, t.kembalian, t.metode, t.status]);
    const csv = [columns, ...rows].map(row => row.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = `laporan-bakepos-${today()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast("Laporan CSV berhasil dibuat.");
  });

  // Settings
  function fillSettings() {
    const fields = { "nama-toko": "toko", "nama-kasir": "kasir", "alamat-toko": "alamat", "kontak-toko": "kontak", "batas-minimal-default": "minimal", "hari-peringatan": "peringatan", "pesan-akhir": "pesan" };
    Object.entries(fields).forEach(([id, key]) => { if ($(`#${id}`)) $(`#${id}`).value = settings[key] ?? ""; });
    if ($("#sidebar-store-name")) $("#sidebar-store-name").textContent = settings.toko;
    if ($("#sidebar-cashier")) $("#sidebar-cashier").textContent = settings.kasir;
  }
  $("#settings-form")?.addEventListener("submit", event => {
    event.preventDefault();
    settings = {
      toko: $("#nama-toko").value.trim() || "Ruang Roti",
      kasir: $("#nama-kasir").value.trim() || "Kasir",
      alamat: $("#alamat-toko").value.trim(),
      kontak: $("#kontak-toko").value.trim(),
      minimal: Math.max(0, Number($("#batas-minimal-default").value) || 0),
      peringatan: Math.max(0, Number($("#hari-peringatan").value) || 0),
      pesan: $("#pesan-akhir").value.trim() || "Terima kasih sudah berbelanja!"
    };
    products.forEach(p => { if (p.minimal == null) p.minimal = settings.minimal; });
    save(); fillSettings(); renderAll(); toast("Pengaturan berhasil disimpan.");
  });
  $("#pulih-demo")?.addEventListener("click", () => {
    if (!confirm("Pulihkan data demo? Data produk dan transaksi saat ini akan diganti.")) return;
    products = demoProducts(); transactions = []; cart = []; save(); renderAll(); toast("Data demo berhasil dipulihkan.");
  });
  $("#hapus-semua")?.addEventListener("click", () => {
    if (!confirm("Hapus semua produk dan transaksi? Pengaturan toko tidak akan dihapus.")) return;
    products = []; transactions = []; cart = []; save(); renderAll(); toast("Data produk dan transaksi dihapus.");
  });

  function renderAll() {
    renderDashboard(); renderCatalog(); renderCart(); renderProducts(); renderStock(); renderTransactions(); renderReport(); fillSettings();
  }
  if ($("#today-date")) $("#today-date").textContent = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  renderAll();
});
