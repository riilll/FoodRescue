DECLARE
    v_produk      Produk_Makanan.id_produk%TYPE;
    v_sesi        Sesi_FlashSale.id_sesi%TYPE;
    v_pembeli_a   Pengguna.id_pengguna%TYPE;
    v_pembeli_b   Pengguna.id_pengguna%TYPE;
    v_pembeli     Pengguna.id_pengguna%TYPE;
    v_pesanan     Transaksi_Pesanan.id_pesanan%TYPE;
    v_mulai       TIMESTAMP WITH TIME ZONE := SYSTIMESTAMP;
BEGIN
    SAVEPOINT awal_seed_1000;

    SELECT MIN(p.id_produk) INTO v_produk
    FROM Produk_Makanan p
    JOIN Mitra_Restoran m ON m.id_mitra = p.id_mitra
    JOIN Pengguna u ON u.id_pengguna = m.id_pengguna
    WHERE u.email = 'mitra.demo@example.com'
      AND p.nama_produk = 'Roti Cokelat';

    IF v_produk IS NULL THEN
        RAISE_APPLICATION_ERROR(-20021, 'Jalankan seed demo 02 terlebih dahulu.');
    END IF;

    INSERT INTO Pengguna (nama, email, password_hash, no_hp, role, saldo)
    VALUES ('Uji Riwayat A', 'riwayat.a@example.com', 'DEMO_TANPA_LOGIN',
            '080000000011', 'mahasiswa', 4900000)
    RETURNING id_pengguna INTO v_pembeli_a;

    INSERT INTO Pengguna (nama, email, password_hash, no_hp, role, saldo)
    VALUES ('Uji Riwayat B', 'riwayat.b@example.com', 'DEMO_TANPA_LOGIN',
            '080000000012', 'mahasiswa', 100000)
    RETURNING id_pengguna INTO v_pembeli_b;

    INSERT INTO Sesi_FlashSale (
        id_produk, mulai_pada, selesai_pada,
        harga_flash, stok_awal, stok_tersedia
    )
    VALUES (v_produk, v_mulai, v_mulai + INTERVAL '2' HOUR, 5000, 1000, 1000)
    RETURNING id_sesi INTO v_sesi;

    FOR i IN 1..1000 LOOP
        IF i <= 980 THEN
            v_pembeli := v_pembeli_a;
        ELSE
            v_pembeli := v_pembeli_b;
        END IF;

        sp_buat_pesanan(v_pembeli, v_sesi, 1, v_pesanan);
        sp_bayar_pesanan(v_pembeli, v_pesanan);
    END LOOP;

    COMMIT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK TO awal_seed_1000;
        RAISE;
END;

SELECT u.email, t.id_pembeli, COUNT(*) AS jumlah_pesanan
FROM Transaksi_Pesanan t
JOIN Pengguna u ON u.id_pengguna = t.id_pembeli
WHERE u.email IN ('riwayat.a@example.com', 'riwayat.b@example.com')
  AND t.status = 'LUNAS'
GROUP BY u.email, t.id_pembeli
ORDER BY u.email;