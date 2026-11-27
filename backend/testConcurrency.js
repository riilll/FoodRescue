const BASE_URL = "http://localhost:5000";

async function runConcurrencyTest() {
  console.log("=== UJI CONCURRENCY FOODRESCUE (ANTI-OVERSELLING) ===\n");

  // 1. Login Mitra
  const mitraLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "warung.mitra@test.com",
      password: "password123",
    }),
  });
  const mitraLogin = await mitraLoginRes.json();
  if (!mitraLoginRes.ok)
    throw new Error(`Gagal login mitra: ${mitraLogin.message}`);
  const mitraToken = mitraLogin.token;

  // 2. Buat produk + sesi flash sale khusus uji rebutan (stok hanya 2 porsi)
  const createRes = await fetch(`${BASE_URL}/api/mitra/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${mitraToken}`,
    },
    body: JSON.stringify({
      nama_produk: "Paket Uji Concurrency",
      deskripsi: "Sesi khusus pengujian race-condition stok terbatas",
      harga_flash: 5000,
      stok_awal: 2,
      durasi_jam: 2,
    }),
  });
  const created = await createRes.json();
  if (!createRes.ok)
    throw new Error(`Gagal membuat sesi uji: ${created.message}`);
  const idSesi = created.data.sesi_flashsale.id_sesi;
  console.log(`Sesi uji dibuat -> id_sesi: ${idSesi}, stok_awal: 2\n`);

  // 3. Login Mahasiswa
  const mhsLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "naja.mhs@test.com",
      password: "password123",
    }),
  });
  const mhsLogin = await mhsLoginRes.json();
  if (!mhsLoginRes.ok)
    throw new Error(`Gagal login mahasiswa: ${mhsLogin.message}`);
  const mhsToken = mhsLogin.token;

  // 4. Tembakkan 6 request pemesanan @1 porsi pada milidetik yang sama
  const TOTAL_REQUESTS = 6;
  console.log(
    `Mengirim ${TOTAL_REQUESTS} request POST /api/orders secara bersamaan...\n`,
  );

  const requests = Array.from({ length: TOTAL_REQUESTS }, (_, idx) =>
    fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mhsToken}`,
      },
      body: JSON.stringify({ id_sesi: idSesi, jumlah: 1 }),
    }).then(async (res) => ({
      reqNo: idx + 1,
      status: res.status,
      body: await res.json(),
    })),
  );

  const results = await Promise.all(requests);

  let sukses = 0;
  let ditolak = 0;
  for (const r of results) {
    if (r.status === 201) {
      sukses++;
      console.log(
        `[Req #${r.reqNo}] ${r.status} BERHASIL -> id_pesanan: ${r.body.data.id_pesanan}`,
      );
    } else {
      ditolak++;
      console.log(
        `[Req #${r.reqNo}] ${r.status} DITOLAK  -> ${r.body.message}`,
      );
    }
  }

  // 5. Verifikasi stok akhir di database
  const checkRes = await fetch(`${BASE_URL}/api/flash-sales/${idSesi}`);
  const checkData = await checkRes.json();

  console.log("\n=== RINGKASAN HASIL ===");
  console.log(`Total Request Paralel : ${TOTAL_REQUESTS}`);
  console.log(`Berhasil (201)        : ${sukses} (Target: 2)`);
  console.log(`Ditolak Stok Habis    : ${ditolak} (Target: 4)`);
  console.log(
    `Stok Akhir di Oracle  : ${checkData.data.stok_tersedia} (Target: 0, tidak boleh minus)`,
  );
}

runConcurrencyTest().catch((err) => {
  console.error("Error uji concurrency:", err.message);
});
