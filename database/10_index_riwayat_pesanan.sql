BEGIN
    DBMS_STATS.GATHER_TABLE_STATS(USER, 'TRANSAKSI_PESANAN');
END;

EXPLAIN PLAN SET STATEMENT_ID = 'FR_SEBELUM_IDX' FOR
SELECT id_pesanan, dibuat_pada, status
FROM Transaksi_Pesanan
WHERE id_pembeli = 22
ORDER BY dibuat_pada DESC, id_pesanan DESC
FETCH FIRST 10 ROWS ONLY;

SELECT plan_table_output
FROM TABLE(DBMS_XPLAN.DISPLAY('PLAN_TABLE', 'FR_SEBELUM_IDX', 'TYPICAL'));

CREATE INDEX idx_pesanan_riwayat
ON Transaksi_Pesanan (id_pembeli, dibuat_pada DESC, id_pesanan DESC);

EXPLAIN PLAN SET STATEMENT_ID = 'FR_SESUDAH_IDX' FOR
SELECT id_pesanan, dibuat_pada, status
FROM Transaksi_Pesanan
WHERE id_pembeli = 22
ORDER BY dibuat_pada DESC, id_pesanan DESC
FETCH FIRST 10 ROWS ONLY;

SELECT plan_table_output
FROM TABLE(DBMS_XPLAN.DISPLAY('PLAN_TABLE', 'FR_SESUDAH_IDX', 'TYPICAL'));