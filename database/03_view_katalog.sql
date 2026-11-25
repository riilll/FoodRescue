
CREATE OR REPLACE VIEW v_katalog_flashsale_aktif AS
SELECT
    s.id_sesi,
    p.nama_produk,
    m.nama_mitra,
    m.alamat,
    s.harga_flash,
    s.stok_tersedia,
    s.selesai_pada
FROM Sesi_FlashSale s
JOIN Produk_Makanan p ON p.id_produk = s.id_produk
JOIN Mitra_Restoran m ON m.id_mitra = p.id_mitra
WHERE s.mulai_pada <= SYSTIMESTAMP
  AND s.selesai_pada > SYSTIMESTAMP
  AND s.stok_tersedia > 0;

SELECT *
FROM v_katalog_flashsale_aktif
WHERE id_sesi = 1;
