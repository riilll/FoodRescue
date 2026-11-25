CREATE OR REPLACE PROCEDURE sp_proses_kedaluwarsa AS
BEGIN
    SAVEPOINT awal_proses_kedaluwarsa;

    FOR pesanan IN (
        SELECT id_pesanan, id_sesi, jumlah
        FROM Transaksi_Pesanan
        WHERE status = 'MENUNGGU_BAYAR'
          AND batas_bayar <= SYSTIMESTAMP
        ORDER BY id_sesi, id_pesanan
        FOR UPDATE SKIP LOCKED
    ) LOOP
        UPDATE Transaksi_Pesanan
        SET status = 'KEDALUWARSA'
        WHERE id_pesanan = pesanan.id_pesanan
          AND status = 'MENUNGGU_BAYAR'
          AND batas_bayar <= SYSTIMESTAMP;

        IF SQL%ROWCOUNT = 1 THEN
            UPDATE Sesi_FlashSale
            SET stok_tersedia = stok_tersedia + pesanan.jumlah
            WHERE id_sesi = pesanan.id_sesi;
        END IF;
    END LOOP;

EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK TO awal_proses_kedaluwarsa;
        RAISE;
END sp_proses_kedaluwarsa;


SELECT object_name, object_type, status
FROM user_objects
WHERE object_name IN (
    'TRG_LOG_PESANAN_KEDALUWARSA',
    'SP_PROSES_KEDALUWARSA'
)
ORDER BY object_type;