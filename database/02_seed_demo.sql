DECLARE
    v_pemilik  Pengguna.id_pengguna%TYPE;
    v_mitra    Mitra_Restoran.id_mitra%TYPE;
    v_produk   Produk_Makanan.id_produk%TYPE;
    v_sekarang TIMESTAMP WITH TIME ZONE := SYSTIMESTAMP;
BEGIN
    SAVEPOINT awal_data_demo;

    INSERT INTO Pengguna (nama, email, password_hash, no_hp, role)
    VALUES (
        'Pemilik Kafe Demo', 'mitra.demo@example.com',
        'DEMO_TANPA_LOGIN', '080000000001', 'mitra'
    )
    RETURNING id_pengguna INTO v_pemilik;

    INSERT INTO Mitra_Restoran (id_pengguna, nama_mitra, alamat, jam_tutup)
    VALUES (v_pemilik, 'Kafe Roti Kampus', 'Gerbang kampus', '21:00')
    RETURNING id_mitra INTO v_mitra;

    INSERT INTO Produk_Makanan (id_mitra, nama_produk, deskripsi)
    VALUES (v_mitra, 'Roti Cokelat', 'Roti isi cokelat dari produksi hari ini')
    RETURNING id_produk INTO v_produk;

    INSERT INTO Sesi_FlashSale (
        id_produk, mulai_pada, selesai_pada,
        harga_flash, stok_awal, stok_tersedia
    )
    VALUES (
        v_produk,
        v_sekarang,
        v_sekarang + INTERVAL '2' HOUR,
        5000, 2, 2
    );

    INSERT INTO Pengguna (nama, email, password_hash, no_hp, role, saldo)
    VALUES (
        'Mahasiswa A', 'mhs.a@example.com', 'DEMO_TANPA_LOGIN',
        '080000000002', 'mahasiswa', 20000
    );

    INSERT INTO Pengguna (nama, email, password_hash, no_hp, role, saldo)
    VALUES (
        'Mahasiswa B', 'mhs.b@example.com', 'DEMO_TANPA_LOGIN',
        '080000000003', 'mahasiswa', 20000
    );

EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK TO awal_data_demo;
        RAISE;
END;

COMMIT;

SELECT
    s.id_sesi,
    m.nama_mitra,
    p.nama_produk,
    s.harga_flash,
    s.stok_tersedia,
    s.selesai_pada
FROM Sesi_FlashSale s
JOIN Produk_Makanan p ON p.id_produk = s.id_produk
JOIN Mitra_Restoran m ON m.id_mitra = p.id_mitra
JOIN Pengguna u ON u.id_pengguna = m.id_pengguna
WHERE u.email = 'mitra.demo@example.com';
