# Barcode Scan Out Counter - Warehouse PMT Jatake

**Version:** 2.1 (revamp, 8 Nov 2026) · Est. 21 Nov 2025
**Creator:** Deva - Parts Management - Customer Care Department
**Live:** https://barcodescanoutcounterpmt.vercel.app

Aplikasi mobile untuk menghitung resi paket yang keluar dari Gudang PMT Jatake.

## Fitur
- Input lewat scanner barcode hardware (USB/Bluetooth) atau ketik manual. Tanpa kamera
- Auto-detect kurir: Lion Parcel, SPX, JNE, 21Express, J&T, J&T Cargo, LEX. Fungsi `detectCourier` disalin verbatim dari v1.2 (script `detect-v12`)
- Resi di luar pola: bunyi peringatan, lalu pilih kurir sekali ketuk
- Single package (resi sama ditolak) / Multi package (resi sama menambah koli; tanggal & jam ikut scan terakhir). Aturan persis v1.2
- Suara sukses, dobel/gagal, dan peringatan disalin verbatim dari v1.2 (script `sound-v12`)
- Setiap scan, revisi, hapus, dan batal hapus dikirim ke Google Sheet. Offline-first: data antre di HP, terkirim saat online
- Cek resi dobel juga ke Google Sheet (resi 30 hari terakhir), jadi tetap aman kalau data HP terhapus
- Tab Hasil (cari, revisi, hapus + batalkan, Export Excel, Export CSV format v1.2), Dashboard (per kurir, per PIC, per jam), Setting
- Desain mengikuti MODENA design system
- Data v1.2 di HP (localStorage `barcodeData`) otomatis dibaca supaya resi lama tetap terdeteksi dobel

## File
- `index.html` : aplikasi (font & SheetJS tertanam, bisa dibuka offline)
- `sw.js` : service worker (cache offline)
- `apps-script/Code.gs` : penerima data di Google Sheet

## Google Sheet
Pasang `apps-script/Code.gs` di Google Sheet (Extensions > Apps Script), deploy sebagai Web app (Execute as: Me, Who has access: Anyone).
URL `/exec` ditanam di `index.html` (blok `sync-config`), atau diisi di Setting > Admin.

Sheet yang dibuat otomatis:
- `LOG_SCAN` : setiap aktivitas (Scan, Revisi, Hapus, Batal hapus)
- `REKAP_RESI` : 1 baris per resi (koli total, kurir, PIC, status Dihapus / Dobel)
- `REKAP_HARIAN` : resi & koli per tanggal per kurir (resi dihapus tidak dihitung)

Kalau `Code.gs` diubah: Deploy > Manage deployments > Edit > Version: New version > Deploy (URL tetap sama).
