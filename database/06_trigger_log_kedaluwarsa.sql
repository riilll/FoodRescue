CREATE OR REPLACE TRIGGER trg_log_pesanan_kedaluwarsa
AFTER UPDATE OF status ON Transaksi_Pesanan
FOR EACH ROW
WHEN (
    OLD.status = 'MENUNGGU_BAYAR'
    AND NEW.status = 'KEDALUWARSA'
)
BEGIN
    INSERT INTO Log_Kedaluwarsa (id_pesanan, dicatat_pada)
    VALUES (:NEW.id_pesanan, SYSTIMESTAMP);
END;


SELECT object_name, object_type, status
FROM user_objects
WHERE object_name IN (
    'TRG_LOG_PESANAN_KEDALUWARSA',
    'SP_PROSES_KEDALUWARSA'
)
ORDER BY object_type;