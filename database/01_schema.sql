CREATE TABLE Pengguna (
    id_pengguna   NUMBER GENERATED ALWAYS AS IDENTITY,
    nama          VARCHAR2(100 CHAR) NOT NULL,
    email         VARCHAR2(254 CHAR) NOT NULL,
    password_hash VARCHAR2(255 CHAR) NOT NULL,
    no_hp         VARCHAR2(20 CHAR)  NOT NULL,
    role          VARCHAR2(10 CHAR)  NOT NULL,
    saldo         NUMBER(12, 0) DEFAULT 0 NOT NULL,

    CONSTRAINT pk_pengguna PRIMARY KEY (id_pengguna),
    CONSTRAINT uq_pengguna_email UNIQUE (email),
    CONSTRAINT ck_pengguna_role CHECK (role IN ('mahasiswa', 'mitra')),
    CONSTRAINT ck_pengguna_saldo CHECK (saldo >= 0)
);

CREATE TABLE Mitra_Restoran (
    id_mitra    NUMBER GENERATED ALWAYS AS IDENTITY,
    id_pengguna NUMBER NOT NULL,
    nama_mitra  VARCHAR2(100 CHAR) NOT NULL,
    alamat      VARCHAR2(255 CHAR) NOT NULL,
    jam_tutup   VARCHAR2(5 CHAR)   NOT NULL,

    CONSTRAINT pk_mitra_restoran PRIMARY KEY (id_mitra),
    CONSTRAINT fk_mitra_pengguna FOREIGN KEY (id_pengguna)
        REFERENCES Pengguna (id_pengguna),
    CONSTRAINT ck_mitra_jam_tutup CHECK (
        REGEXP_LIKE(jam_tutup, '^([01][0-9]|2[0-3]):[0-5][0-9]$')
    )
);

SELECT table_name
FROM user_tables
WHERE table_name IN ('PENGGUNA', 'MITRA_RESTORAN')
ORDER BY table_name;

CREATE TABLE Produk_Makanan (
    id_produk   NUMBER GENERATED ALWAYS AS IDENTITY,
    id_mitra    NUMBER NOT NULL,
    nama_produk VARCHAR2(100 CHAR) NOT NULL,
    deskripsi   VARCHAR2(500 CHAR),

    CONSTRAINT pk_produk_makanan PRIMARY KEY (id_produk),
    CONSTRAINT fk_produk_mitra FOREIGN KEY (id_mitra)
        REFERENCES Mitra_Restoran (id_mitra)
);

CREATE TABLE Sesi_FlashSale (
    id_sesi       NUMBER GENERATED ALWAYS AS IDENTITY,
    id_produk     NUMBER NOT NULL,
    mulai_pada    TIMESTAMP WITH TIME ZONE NOT NULL,
    selesai_pada  TIMESTAMP WITH TIME ZONE NOT NULL,
    harga_flash   NUMBER(12, 0) NOT NULL,
    stok_awal     NUMBER(8, 0) NOT NULL,
    stok_tersedia NUMBER(8, 0) NOT NULL,

    CONSTRAINT pk_sesi_flashsale PRIMARY KEY (id_sesi),
    CONSTRAINT fk_sesi_produk FOREIGN KEY (id_produk)
        REFERENCES Produk_Makanan (id_produk),
    CONSTRAINT ck_sesi_waktu CHECK (selesai_pada > mulai_pada),
    CONSTRAINT ck_sesi_harga CHECK (harga_flash > 0),
    CONSTRAINT ck_sesi_stok_awal CHECK (stok_awal > 0),
    CONSTRAINT ck_sesi_stok_tersedia CHECK (
        stok_tersedia BETWEEN 0 AND stok_awal
    )
);

SELECT table_name
FROM user_tables
WHERE table_name IN (
    'PENGGUNA',
    'MITRA_RESTORAN',
    'PRODUK_MAKANAN',
    'SESI_FLASHSALE'
)
ORDER BY table_name;

CREATE TABLE Transaksi_Pesanan (
    id_pesanan         NUMBER GENERATED ALWAYS AS IDENTITY,
    id_pembeli         NUMBER NOT NULL,
    id_sesi            NUMBER NOT NULL,
    jumlah             NUMBER(8, 0) NOT NULL,
    harga_satuan_pesan NUMBER(12, 0) NOT NULL,
    dibuat_pada        TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    batas_bayar        TIMESTAMP WITH TIME ZONE NOT NULL,
    status             VARCHAR2(20 CHAR) DEFAULT 'MENUNGGU_BAYAR' NOT NULL,

    CONSTRAINT pk_transaksi_pesanan PRIMARY KEY (id_pesanan),
    CONSTRAINT fk_pesanan_pembeli FOREIGN KEY (id_pembeli)
        REFERENCES Pengguna (id_pengguna),
    CONSTRAINT fk_pesanan_sesi FOREIGN KEY (id_sesi)
        REFERENCES Sesi_FlashSale (id_sesi),
    CONSTRAINT ck_pesanan_jumlah CHECK (jumlah > 0),
    CONSTRAINT ck_pesanan_harga CHECK (harga_satuan_pesan > 0),
    CONSTRAINT ck_pesanan_batas CHECK (batas_bayar > dibuat_pada),
    CONSTRAINT ck_pesanan_status CHECK (
        status IN ('MENUNGGU_BAYAR', 'LUNAS', 'KEDALUWARSA')
    )
);

CREATE TABLE Pembayaran (
    id_pembayaran NUMBER GENERATED ALWAYS AS IDENTITY,
    id_pesanan    NUMBER NOT NULL,
    nominal       NUMBER(20, 0) NOT NULL,
    dibayar_pada  TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,

    CONSTRAINT pk_pembayaran PRIMARY KEY (id_pembayaran),
    CONSTRAINT fk_pembayaran_pesanan FOREIGN KEY (id_pesanan)
        REFERENCES Transaksi_Pesanan (id_pesanan),
    CONSTRAINT uq_pembayaran_pesanan UNIQUE (id_pesanan),
    CONSTRAINT ck_pembayaran_nominal CHECK (nominal > 0)
);


CREATE TABLE Log_Kedaluwarsa (
    id_log       NUMBER GENERATED ALWAYS AS IDENTITY,
    id_pesanan   NUMBER NOT NULL,
    dicatat_pada TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,

    CONSTRAINT pk_log_kedaluwarsa PRIMARY KEY (id_log),
    CONSTRAINT fk_log_pesanan FOREIGN KEY (id_pesanan)
        REFERENCES Transaksi_Pesanan (id_pesanan),
    CONSTRAINT uq_log_pesanan UNIQUE (id_pesanan)
);

SELECT table_name
FROM user_tables
WHERE table_name IN (
    'PENGGUNA', 'MITRA_RESTORAN', 'PRODUK_MAKANAN', 'SESI_FLASHSALE',
    'TRANSAKSI_PESANAN', 'PEMBAYARAN', 'LOG_KEDALUWARSA'
)
ORDER BY table_name;