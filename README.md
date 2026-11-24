# FoodRescue

**Struktur Folder Secara Umum**
```
foodrescue/                  <-- folder repo GitHub kalian
├── frontend/                <-- bagian Bg Habib
├── backend/                 <-- bagian Naja
├── database/                <-- bagian Fahril (ERD & skrip SQL)
└── README.md                <-- dikerjakan bareng
```

**Struktur Folder yang backend**
```
backend/
├── config/
│   └── db.js               # Konfigurasi connection pool Oracle (oracledb Thin Mode)
├── middleware/
│   ├── authMiddleware.js   # Verifikasi JWT & cek role (mahasiswa / mitra)
│   └── errorHandler.js     # Penanganan error transaksi, stok habis, & Oracle error
├── routes/
│   ├── authRoutes.js
│   ├── productRoutes.js
│   ├── orderRoutes.js
│   └── paymentRoutes.js
├── controllers/
│   ├── authController.js
│   ├── productController.js
│   ├── orderController.js
│   └── paymentController.js
├── .env                    # JANGAN DI-COMMIT (masuk .gitignore)
├── .env.example            # Template variabel tanpa nilai asli (WAJIB ada di repo)
├── .gitignore
├── package.json
└── server.js
```