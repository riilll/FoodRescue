CREATE OR REPLACE PROCEDURE sp_buat_pesanan (
    p_id_pembeli IN  Pengguna.id_pengguna%TYPE,
    p_id_sesi    IN  Sesi_FlashSale.id_sesi%TYPE,
    p_jumlah     IN  NUMBER,
    p_id_pesanan OUT Transaksi_Pesanan.id_pesanan%TYPE
) AS
    v_role     Pengguna.role%TYPE;
    v_sesi     Sesi_FlashSale%ROWTYPE;
    v_sekarang Transaksi_Pesanan.dibuat_pada%TYPE;
BEGIN
    SAVEPOINT awal_buat_pesanan;

    IF p_jumlah IS NULL OR p_jumlah < 1 OR p_jumlah <> TRUNC(p_jumlah) THEN
        RAISE_APPLICATION_ERROR(-20001, 'Jumlah harus berupa bilangan bulat positif.');
    END IF;

    BEGIN
        SELECT role INTO v_role
        FROM Pengguna
        WHERE id_pengguna = p_id_pembeli;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RAISE_APPLICATION_ERROR(-20002, 'Akun pembeli tidak ditemukan.');
    END;

    IF v_role <> 'mahasiswa' THEN
        RAISE_APPLICATION_ERROR(-20003, 'Pemesanan hanya tersedia untuk mahasiswa.');
    END IF;

    BEGIN
        SELECT * INTO v_sesi
        FROM Sesi_FlashSale
        WHERE id_sesi = p_id_sesi
        FOR UPDATE;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RAISE_APPLICATION_ERROR(-20004, 'Sesi flash sale tidak ditemukan.');
    END;

    -- Ambil waktu setelah mendapat kunci, karena pesanan bisa sempat menunggu.
    v_sekarang := SYSTIMESTAMP;

    IF v_sekarang < v_sesi.mulai_pada OR v_sekarang >= v_sesi.selesai_pada THEN
        RAISE_APPLICATION_ERROR(-20005, 'Sesi flash sale sedang tidak aktif.');
    END IF;

    IF p_jumlah > v_sesi.stok_tersedia THEN
        RAISE_APPLICATION_ERROR(-20006, 'Stok yang tersisa tidak mencukupi.');
    END IF;

    UPDATE Sesi_FlashSale
    SET stok_tersedia = stok_tersedia - p_jumlah
    WHERE id_sesi = p_id_sesi;

    INSERT INTO Transaksi_Pesanan (
        id_pembeli, id_sesi, jumlah, harga_satuan_pesan,
        dibuat_pada, batas_bayar, status
    )
    VALUES (
        p_id_pembeli, p_id_sesi, p_jumlah, v_sesi.harga_flash,
        v_sekarang, v_sekarang + INTERVAL '10' MINUTE, 'MENUNGGU_BAYAR'
    )
    RETURNING id_pesanan INTO p_id_pesanan;

EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK TO awal_buat_pesanan;
        RAISE;
END sp_buat_pesanan;

SELECT object_name, status
FROM user_objects
WHERE object_name = 'SP_BUAT_PESANAN'
  AND object_type = 'PROCEDURE';