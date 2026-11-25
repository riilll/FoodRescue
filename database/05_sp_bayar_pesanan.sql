CREATE OR REPLACE PROCEDURE sp_bayar_pesanan (
    p_id_pembeli IN Pengguna.id_pengguna%TYPE,
    p_id_pesanan IN Transaksi_Pesanan.id_pesanan%TYPE
) AS
    v_pesanan      Transaksi_Pesanan%ROWTYPE;
    v_saldo        Pengguna.saldo%TYPE;
    v_total        Pembayaran.nominal%TYPE;
    v_waktu_bayar  Pembayaran.dibayar_pada%TYPE;
BEGIN
    SAVEPOINT awal_bayar_pesanan;

    -- Dua permintaan bayar untuk pesanan yang sama diproses bergiliran.
    BEGIN
        SELECT *
        INTO v_pesanan
        FROM Transaksi_Pesanan
        WHERE id_pesanan = p_id_pesanan
          AND id_pembeli = p_id_pembeli
        FOR UPDATE;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RAISE_APPLICATION_ERROR(-20011, 'Pesanan tidak ditemukan untuk akun ini.');
    END;

    IF v_pesanan.status <> 'MENUNGGU_BAYAR' THEN
        RAISE_APPLICATION_ERROR(-20012, 'Pesanan sudah lunas atau kedaluwarsa.');
    END IF;

    -- Satu mahasiswa juga bisa membayar dua pesanan berbeda secara bersamaan.
    SELECT saldo
    INTO v_saldo
    FROM Pengguna
    WHERE id_pengguna = p_id_pembeli
    FOR UPDATE;

    -- Periksa tenggat setelah kedua kunci diperoleh.
    v_waktu_bayar := SYSTIMESTAMP;

    IF v_waktu_bayar >= v_pesanan.batas_bayar THEN
        RAISE_APPLICATION_ERROR(-20013, 'Batas waktu pembayaran sudah lewat.');
    END IF;

    v_total := v_pesanan.jumlah * v_pesanan.harga_satuan_pesan;

    IF v_saldo < v_total THEN
        RAISE_APPLICATION_ERROR(-20014, 'Saldo tidak mencukupi.');
    END IF;

    UPDATE Pengguna
    SET saldo = saldo - v_total
    WHERE id_pengguna = p_id_pembeli;

    INSERT INTO Pembayaran (id_pesanan, nominal, dibayar_pada)
    VALUES (p_id_pesanan, v_total, v_waktu_bayar);

    UPDATE Transaksi_Pesanan
    SET status = 'LUNAS'
    WHERE id_pesanan = p_id_pesanan;

EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK TO awal_bayar_pesanan;
        RAISE;
END sp_bayar_pesanan;

SELECT object_name, status
FROM user_objects
WHERE object_name = 'SP_BAYAR_PESANAN'
  AND object_type = 'PROCEDURE';