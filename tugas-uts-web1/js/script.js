/* ===== Utilitas ===== */
const $ = s => document.querySelector(s);
const rp = n => typeof n === "number" ? "Rp " + n.toLocaleString("id-ID") : n;
const esc = t => String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// Fungsi pembantu untuk memproses harga string dari data dosen (contoh: "Rp 180.000" -> 180000)
const parseHarga = (h) => {
    if (typeof h === "number") return h;
    return Number(String(h).replace(/[^0-9]/g, "")) || 0;
};

// Menyesuaikan struktur data dari dosen agar seragam dengan script
const formatBuku = b => ({
    kode: b.kodeBarang || b.kode,
    judul: b.namaBarang || b.judul,
    kategori: b.jenisBarang || b.kategori,
    harga: parseHarga(b.harga),
    stok: b.stok,
    gambar: b.cover || b.gambar
});

const katalog = () => (typeof dataKatalogBuku !== "undefined" ? dataKatalogBuku.map(formatBuku) : []).concat(load("tambahan", []));

// Konversi data tracking dosen agar kompatibel dengan sistem tracking & riwayat
const getTrackingNormalized = () => {
    if (typeof dataTracking === "undefined") return [];
    if (Array.isArray(dataTracking)) return dataTracking;
    // Jika dataTracking berupa object bawaan dari dosen
    return Object.keys(dataTracking).map(k => {
        let t = dataTracking[k];
        return {
            noDO: t.nomorDO || k,
            nama: t.nama,
            tanggal: t.tanggalKirim || "2026-01-01",
            ekspedisi: t.ekspedisi,
            paket: t.paket,
            total: parseHarga(t.total),
            status: t.status === "Selesai Antar" ? 4 : 2, // Konversi status string ke angka status indeks
            metode: "Transfer Bank",
            items: [{ judul: "Buku Paket Ajar", qty: 1 }]
        };
    });
};

const semuaPesanan = () => load("riwayat", []).concat(getTrackingNormalized());
const tglID = t => new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

const statusPengiriman = ["Diproses", "Dikemas", "Dalam Perjalanan", "Menuju Lokasi", "Selesai"];
const dataEkspedisi = { "JNE": 15000, "J&T": 14000, "Pos Indonesia": 12000, "SiCepat": 16000 };

// Pop-up / modal box
function popup(judul, isi) {
    const o = document.createElement("div");
    o.className = "overlay";
    o.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><h2>${judul}</h2><div>${isi}</div>
        <div class="modal-aksi"><button class="btn btn-ghost" data-x>Tutup</button></div></div>`;
    document.body.appendChild(o);
    o.addEventListener("click", e => { if (e.target === o || e.target.hasAttribute("data-x")) o.remove(); });
    return o;
}

/* ===== Penjaga sesi ===== */
const halaman = document.body.dataset.page;
const user = JSON.parse(sessionStorage.getItem("user") || "null");
if (halaman !== "login" && !user) location.replace("index.html");
const keluar = $("#btnKeluar");
if (keluar) keluar.onclick = () => { sessionStorage.removeItem("user"); location.href = "index.html"; };

/* ===== Logika per halaman ===== */
const pages = {
    login() {
        const semuaUser = () => (typeof dataPengguna !== "undefined" ? dataPengguna : []).concat(load("users", []));
        $("#formLogin").addEventListener("submit", e => {
            e.preventDefault();
            const em = $("#email").value.trim().toLowerCase(), pw = $("#password").value;
            if (!em || !pw) return popup("Data belum lengkap", "<p>Email dan password wajib diisi.</p>");
            const u = semuaUser().find(x => x.email === em && x.password === pw);
            if (!u) return popup("Login gagal", "<p>Email/password yang anda masukkan salah.</p>");
            sessionStorage.setItem("user", JSON.stringify(u));
            location.href = "dashboard.html";
        });
        $("#btnLupa").onclick = () => {
            const o = popup("Lupa Password", `<form id="fLupa" novalidate><label for="lupaEmail">Email terdaftar</label>
                <input id="lupaEmail" type="email"><p class="err" id="errLupa"></p><button class="btn">Kirim tautan reset</button></form>`);
            o.querySelector("#fLupa").onsubmit = ev => {
                ev.preventDefault();
                const v = o.querySelector("#lupaEmail").value.trim().toLowerCase();
                if (!semuaUser().some(x => x.email === v)) { o.querySelector("#errLupa").textContent = "Email tidak terdaftar."; return; }
                o.remove(); popup("Tautan terkirim", `<p>Tautan reset password dikirim ke ${esc(v)} (simulasi).</p>`);
            };
        };
        $("#btnDaftar").onclick = () => {
            const o = popup("Daftar Akun", `<form id="fDaftar" novalidate>
                <label for="dNama">Nama lengkap</label><input id="dNama"><label for="dEmail">Email</label><input id="dEmail" type="email">
                <label for="dPass">Password (min. 6 karakter)</label><input id="dPass" type="password"><p class="err" id="errDaftar"></p>
                <button class="btn">Buat akun</button></form>`);
            o.querySelector("#fDaftar").onsubmit = ev => {
                ev.preventDefault();
                const nama = o.querySelector("#dNama").value.trim(), em = o.querySelector("#dEmail").value.trim().toLowerCase(), pw = o.querySelector("#dPass").value;
                const er = o.querySelector("#errDaftar");
                if (nama.length < 3) return er.textContent = "Nama minimal 3 karakter.";
                if (!/^\S+@\S+\.\S+$/.test(em)) return er.textContent = "Format email tidak valid.";
                if (pw.length < 6) return er.textContent = "Password minimal 6 karakter.";
                if (semuaUser().some(x => x.email === em)) return er.textContent = "Email sudah terdaftar.";
                save("users", load("users", []).concat({ nama, email: em, password: pw }));
                o.remove(); popup("Pendaftaran berhasil", "<p>Silakan login dengan akun baru Anda.</p>");
            };
        };
    },

    dashboard() {
        const j = new Date().getHours();
        const w = j < 11 ? "pagi" : j < 15 ? "siang" : j < 18 ? "sore" : "malam";
        $("#sapaan").textContent = `Selamat ${w}, ${user.nama}!`;
        $("#jam").textContent = new Date().toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" });
    },

    stok() {
        const tb = $("#tbStok tbody");
        const tambahBaris = b => {
            const tr = tb.insertRow();
            const c = tr.insertCell(), cv = document.createElement("div"); cv.className = "cover";
            const img = new Image(); img.alt = b.judul;
            img.onerror = () => { img.remove(); cv.textContent = "📘"; };
            if (b.gambar) img.src = b.gambar; else cv.textContent = "📘";
            if (b.gambar) cv.appendChild(img);
            c.appendChild(cv);
            [b.kode, b.judul, b.kategori, rp(b.harga)].forEach(v => tr.insertCell().textContent = v);
            const s = tr.insertCell(); s.textContent = b.stok; if (b.stok <= 5) s.className = "rendah";
        };
        const render = (kata = "") => {
            tb.replaceChildren();
            katalog().filter(b => (String(b.judul || "") + String(b.kode || "") + String(b.kategori || "")).toLowerCase().includes(kata)).forEach(tambahBaris);
            $("#jumlah").textContent = tb.rows.length + " judul ditampilkan";
        };
        render();
        $("#cari").oninput = e => render(e.target.value.trim().toLowerCase());
        $("#formStok").onsubmit = e => {
            e.preventDefault();
            const v = id => $("#" + id).value.trim(), er = [];
            const kode = v("kode").toUpperCase(), harga = parseInt(v("harga")), stok = parseInt(v("jml"));
            if (!/^BK\d{3}$/.test(kode)) er.push("Kode harus berformat BK diikuti 3 angka, contoh BK007.");
            if (katalog().some(b => b.kode === kode)) er.push("Kode sudah dipakai.");
            if (v("judul").length < 3) er.push("Judul minimal 3 karakter.");
            if (!v("kategori")) er.push("Kategori wajib diisi.");
            if (!(harga > 0)) er.push("Harga harus lebih dari 0.");
            if (!(stok >= 0)) er.push("Stok tidak boleh kosong atau negatif.");
            if (er.length) return popup("Periksa isian", "<ul>" + er.map(x => `<li>${x}</li>`).join("") + "</ul>");
            const b = { kode, judul: v("judul"), kategori: v("kategori"), harga, stok, gambar: "" };
            save("tambahan", load("tambahan", []).concat(b));
            tambahBaris(b); $("#jumlah").textContent = tb.rows.length + " judul ditampilkan";
            e.target.reset(); popup("Berhasil", `<p>Buku <b>${esc(b.judul)}</b> ditambahkan ke katalog.</p>`);
        };
    },

    checkout() {
        let cart = [];
        const sel = $("#pilihBuku"), eks = $("#ekspedisi"), tb = $("#tbCart tbody");
        katalog().forEach(b => sel.add(new Option(`${b.judul} — ${rp(b.harga)} (stok ${b.stok})`, b.kode)));
        Object.keys(dataEkspedisi).forEach(k => eks.add(new Option(`${k} — ${rp(dataEkspedisi[k])}`, k)));
        $("#nama").value = user.nama; $("#emailP").value = user.email;
        const hitung = () => {
            const s = cart.reduce((a, c) => a + c.harga * c.qty, 0), o = cart.length ? (dataEkspedisi[eks.value] || 0) : 0;
            $("#subtotal").textContent = rp(s); $("#ongkir").textContent = rp(o); $("#total").textContent = rp(s + o);
            return s + o;
        };
        const render = () => {
            tb.replaceChildren();
            cart.forEach((c, i) => {
                const tr = tb.insertRow();
                tr.insertCell().textContent = c.judul; tr.insertCell().textContent = rp(c.harga);
                const q = document.createElement("input"); q.type = "number"; q.min = 1; q.max = c.stok; q.value = c.qty;
                q.setAttribute("aria-label", "Jumlah " + c.judul);
                q.onchange = () => {
                    const v = parseInt(q.value);
                    if (!v || v < 1 || v > c.stok) { popup("Jumlah tidak valid", `<p>Jumlah harus antara 1 dan ${c.stok}.</p>`); q.value = c.qty; return; }
                    c.qty = v; render();
                };
                tr.insertCell().appendChild(q); tr.insertCell().textContent = rp(c.harga * c.qty);
                const h = document.createElement("button"); h.type = "button"; h.className = "btn btn-small btn-danger"; h.textContent = "Hapus";
                h.onclick = () => { cart.splice(i, 1); render(); };
                tr.insertCell().appendChild(h);
            });
            $("#kosong").hidden = cart.length > 0; hitung();
        };
        $("#btnTambah").onclick = () => {
            const b = katalog().find(x => x.kode === sel.value), n = parseInt($("#qty").value);
            if (!b) return popup("Pilih buku", "<p>Pilih buku terlebih dahulu.</p>");
            if (!n || n < 1) return popup("Jumlah tidak valid", "<p>Jumlah minimal 1.</p>");
            const ada = cart.find(c => c.kode === b.kode), tot = (ada ? ada.qty : 0) + n;
            if (tot > b.stok) return popup("Stok tidak cukup", `<p>Stok <b>${esc(b.judul)}</b> hanya ${b.stok}.</p>`);
            if (ada) ada.qty = tot; else cart.push({ kode: b.kode, judul: b.judul, harga: b.harga, stok: b.stok, qty: n });
            render();
        };
        eks.onchange = hitung;
        $("#formCheckout").onsubmit = e => {
            e.preventDefault();
            const f = id => $("#" + id).value.trim(), er = [];
            if (!cart.length) er.push("Keranjang masih kosong.");
            if (f("nama").length < 3) er.push("Nama minimal 3 karakter.");
            if (!/^\S+@\S+\.\S+$/.test(f("emailP"))) er.push("Format email tidak valid.");
            if (!/^08\d{8,11}$/.test(f("telp"))) er.push("No. HP harus diawali 08 (10–13 digit).");
            if (f("alamat").length < 10) er.push("Alamat minimal 10 karakter.");
            if (!eks.value) er.push("Pilih ekspedisi.");
            if (!f("metode")) er.push("Pilih metode pembayaran.");
            if (er.length) return popup("Periksa isian", "<ul>" + er.map(x => `<li>${x}</li>`).join("") + "</ul>");
            const noDO = "DO" + new Date().getFullYear() + String(Math.floor(Math.random() * 9000) + 1000);
            const total = hitung();
            save("riwayat", [{ noDO, nama: f("nama"), tanggal: new Date().toISOString().slice(0, 10), ekspedisi: eks.value, paket: f("paket"),
                total, status: 0, metode: f("metode"), items: cart.map(c => ({ judul: c.judul, qty: c.qty })) }].concat(load("riwayat", [])));
            cart = []; render(); e.target.reset(); $("#nama").value = user.nama; $("#emailP").value = user.email;
            popup("Pesanan berhasil", `<p>Terima kasih! Nomor Delivery Order Anda:</p><p><span class="lencana">${noDO}</span></p>
                <p>Total pembayaran ${rp(total)}. Gunakan nomor ini di halaman <a href="tracking.html">Tracking</a>.</p>`);
        };
        render();
    },

    tracking() {
        const hasil = $("#hasil");
        $("#formCari").onsubmit = e => {
            e.preventDefault();
            const no = $("#noDO").value.trim().toUpperCase();
            if (!no) return popup("Nomor kosong", "<p>Masukkan Nomor Delivery Order.</p>");
            const p = semuaPesanan().find(x => x.noDO === no);
            if (!p) { hasil.hidden = true; return popup("Tidak ditemukan", `<p>Nomor <b>${esc(no)}</b> tidak ada. Coba gunakan nomor DO yang tersedia.</p>`); }
            hasil.hidden = false;
            $("#hNama").textContent = p.nama; $("#hEks").textContent = p.ekspedisi; $("#hTgl").textContent = tglID(p.tanggal);
            $("#hPaket").textContent = p.paket; $("#hTotal").textContent = rp(p.total); $("#hStatus").textContent = statusPengiriman[p.status];
            $("#hItem").textContent = p.items.map(i => `${i.judul} ×${i.qty}`).join(", ");
            $("#bar").style.width = "0%"; requestAnimationFrame(() => requestAnimationFrame(() => $("#bar").style.width = (p.status / 4 * 100) + "%"));
            $("#langkah").replaceChildren(...statusPengiriman.map((s, i) => {
                const li = document.createElement("li"); li.textContent = (i < p.status ? "✓ " : "") + s;
                li.className = i < p.status ? "selesai" : i === p.status ? "aktif" : ""; return li;
            }));
        };
    },

    riwayat() {
        const data = semuaPesanan(), tb = $("#tbRiwayat tbody");
        data.forEach(p => {
            const tr = tb.insertRow();
            [p.noDO, tglID(p.tanggal), p.nama, p.items.map(i => `${i.judul} ×${i.qty}`).join(", "), p.ekspedisi, rp(p.total), statusPengiriman[p.status]]
                .forEach(v => tr.insertCell().textContent = v);
        });
        $("#rTrx").textContent = data.length;
        $("#rOmzet").textContent = rp(data.reduce((a, p) => a + p.total, 0));
        $("#rBuku").textContent = data.reduce((a, p) => a + p.items.reduce((x, i) => x + i.qty, 0), 0);
        $("#rSelesai").textContent = data.filter(p => p.status === 4).length;
    }
};

if (pages[halaman]) {
    pages[halaman]();
}