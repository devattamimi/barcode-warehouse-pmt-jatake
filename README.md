# Barcode Scan Out Counter - Warehouse PMT Jatake

**Version:** 2.0 (revamp, 7 Nov 2026) · Est. 21 Nov 2025
**Creator:** Deva - Parts Management - Customer Care Department
**Live:** https://barcodescanoutcounterpmt.vercel.app

Aplikasi mobile untuk menghitung resi paket yang keluar dari Gudang PMT Jatake.

## Fitur
- Scan resi lewat kamera (barcode 1D & QR, BarcodeDetector + ZXing tertanam) atau scanner genggam USB/Bluetooth
- Auto-detect kurir: Lion Parcel, SPX, JNE, 21Express, J&T, J&T Cargo, LEX (pola dari 1.381 sampel resi). Resi di luar pola: pilih kurir sekali ketuk
- Single package (resi sama ditolak) / Multi package (resi sama menambah koli)
- Cek resi dobel lintas HP (daftar resi 30 hari terakhir dari Google Sheet, diperbarui tiap 2 menit)
- Setiap scan, revisi, dan hapus dikirim ke Google Sheet. Offline-first: data antre di HP, terkirim saat online
- Tab Hasil (cari, revisi, hapus + batalkan, Export Excel), Dashboard (per kurir, per PIC, per jam; semua HP atau HP ini), Setting
- Desain mengikuti MODENA design system (Inter, hitam/putih + oranye korporat), sama dengan aplikasi Spare Parts Stock Management
- Data v1.2 di HP (localStorage `barcodeData`) otomatis dibaca supaya resi lama tetap terdeteksi dobel (tidak dikirim ke Sheet)

## File
- `index.html` : aplikasi (font, SheetJS, ZXing tertanam, bisa dibuka offline)
- `sw.js` : service worker (cache offline)
- `apps-script/Code.gs` : penerima data di Google Sheet

## Google Sheet
Pasang `apps-script/Code.gs` di Google Sheet (Extensions > Apps Script), deploy sebagai Web app (Execute as: Me, Who has access: Anyone).
URL `/exec` ditanam di `index.html` (blok `sync-config`), atau diisi per HP di Setting > Admin.

Sheet yang dibuat otomatis:
- `LOG_SCAN` : setiap aktivitas (Scan, Revisi, Hapus, Batal hapus) dari semua HP
- `REKAP_RESI` : 1 baris per resi (koli total, kurir, PIC, status Dihapus / Dobel)
- `REKAP_HARIAN` : resi & koli per tanggal per kurir

Kalau `Code.gs` diubah: Deploy > Manage deployments > Edit > Version: New version > Deploy (URL tetap sama).
